"""FastAPI application: login API, WebSocket, health check and the static UI."""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from importlib import resources
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from fastapi import FastAPI, Request, Response, WebSocket
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

from tracks_dsp_controller import __version__
from tracks_dsp_controller.device.session import DeviceSession, ProfileFactory
from tracks_dsp_controller.protocol.profile import ProtocolProfile, load_profile
from tracks_dsp_controller.server.auth import (
    SESSION_COOKIE,
    AuthManager,
    LoginError,
    RateLimitedError,
)
from tracks_dsp_controller.server.devices import Device, DeviceManager, build_devices
from tracks_dsp_controller.server.lock import LockManager
from tracks_dsp_controller.server.master import MasterManager
from tracks_dsp_controller.server.settings import DEFAULT_PIN, ServerConfig
from tracks_dsp_controller.server.ws import Hub
from tracks_dsp_controller.simulator import SimulatedDevice, SimulatorServer
from tracks_dsp_controller.state.store import StateStore

log = logging.getLogger(__name__)

LOCK_TICK_S = 1.0
# The master role ends when its holder has had no connection open for this long (a phone asleep,
# a closed tab), and with it the block on new logins.
MASTER_ABSENT_S = 300.0

PLACEHOLDER_HTML = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DSP control</title></head>
<body style="font-family: system-ui, sans-serif; margin: 2rem; background: #111; color: #eee">
<h1>The web UI is not built</h1>
<p>The server is running, but <code>src/tracks_dsp_controller/web/</code> has no
<code>index.html</code>. Build it with <code>make web</code> (needs Node), or use a release
package.</p>
</body></html>
"""


class LoginBody(BaseModel):
    pin: str
    name: str | None = None


def default_web_dir() -> Path:
    return Path(str(resources.files("tracks_dsp_controller").joinpath("web")))


@dataclass
class AppContext:
    config: ServerConfig
    profile: ProtocolProfile
    devices: DeviceManager
    auth: AuthManager
    lock: LockManager  # control: one for the server, over every DSP
    master: MasterManager
    hub: Hub

    # The first DSP (the only one without --dsp).
    @property
    def device(self) -> Device:
        return self.devices.default

    @property
    def session(self) -> DeviceSession:
        return self.devices.default.session

    @property
    def store(self) -> StateStore:
        return self.devices.default.store

    @property
    def simulator(self) -> SimulatorServer | None:
        return self.devices.default.simulator


# A frontend served elsewhere (an app embedding the UI, another server) authenticates with the
# token of the login answer instead of the cookie: "Authorization: Bearer" over HTTP, and on the
# WebSocket (a browser cannot set its headers) the subprotocol "tdsp.token.<token>" offered with
# "tdsp", which the server selects. Not in the URL: uvicorn logs WebSocket paths.
WS_PROTOCOL = "tdsp"
WS_TOKEN_PREFIX = "tdsp.token."


def request_token(request: Request) -> str | None:
    """The session token: "Authorization: Bearer" (a frontend on another origin), else the
    cookie (this server's own pages)."""
    scheme, _, value = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() == "bearer" and value.strip():
        return value.strip()
    return request.cookies.get(SESSION_COOKIE)


def websocket_token(websocket: WebSocket) -> str | None:
    """The token offered as a ``tdsp.token.<token>`` subprotocol, if any."""
    for item in websocket.headers.get("sec-websocket-protocol", "").split(","):
        item = item.strip()
        if item.startswith(WS_TOKEN_PREFIX):
            return item.removeprefix(WS_TOKEN_PREFIX) or None
    return None


def _origin_allowed(websocket: WebSocket) -> bool:
    """Reject cross-site WebSocket connections that rely on the cookie (the Origin host must
    match the Host header)."""
    origin = websocket.headers.get("origin")
    if origin is None:  # non-browser client
        return True
    return urlsplit(origin).netloc == websocket.headers.get("host", "")


def create_app(
    config: ServerConfig,
    profile: ProtocolProfile,
    *,
    web_dir: Path | None = None,
    simulated_device: SimulatedDevice | None = None,
    profile_for: ProfileFactory | None = None,
) -> FastAPI:
    """Build the application. The device session starts with the app's lifespan.

    ``profile`` is the profile used until the device is identified; ``profile_for`` builds the
    profile of another model (default: the built-in one)."""
    web_root = web_dir or default_web_dir()
    base_profile_for = profile_for or (lambda key: load_profile(model=key))

    def with_timeout(p: ProtocolProfile) -> ProtocolProfile:
        if config.command_timeout_s is None:
            return p
        floor = config.command_timeout_s  # --command-timeout: the adaptive timeout's floor
        ceiling = max(floor, p.command_timeout_max_s)
        return p.with_overrides(
            {"timing": {"command_timeout_s": floor, "command_timeout_max_s": ceiling}}
        )

    def model_profile(key: str) -> ProtocolProfile:
        return with_timeout(base_profile_for(key))

    profile = with_timeout(profile)
    devices = build_devices(config, profile, model_profile, simulated_device=simulated_device)
    auth = AuthManager(config.pin, config.view_pin)
    lock = LockManager(config.lock_idle_timeout_s)
    master = MasterManager(MASTER_ABSENT_S)
    hub = Hub(config, devices, auth, lock, master)
    ctx = AppContext(config, profile, devices, auth, lock, master, hub)

    @contextlib.asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        if config.pin == DEFAULT_PIN:
            log.warning("using the default access code %s: set --pin or TDSP_PIN", DEFAULT_PIN)
        await devices.start()
        tasks = [asyncio.create_task(_ticker(lock, master))]
        if config.resync_interval_s > 0:
            tasks.append(asyncio.create_task(devices.resync_loop(config.resync_interval_s)))
        try:
            yield
        finally:
            for task in tasks:
                task.cancel()
            await devices.stop()

    app = FastAPI(title="tracks-dsp-controller", version=__version__, lifespan=lifespan,
                  docs_url=None, redoc_url=None, openapi_url=None)  # fmt: skip
    app.state.ctx = ctx
    # CORS for any origin, without credentials: the token is sent explicitly, never a cookie.
    # Private Network Access: a page from a public origin may call this server on the LAN.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_private_network=True,
        allow_methods=["GET", "POST"],
        allow_headers=["authorization", "content-type"],
        max_age=600,
    )

    @app.post("/api/login")
    async def login(body: LoginBody, request: Request, response: Response) -> dict[str, Any]:
        address = request.client.host if request.client else "unknown"
        try:
            read_only = auth.check_pin(body.pin, address)
        except RateLimitedError as exc:
            return JSONResponse(  # type: ignore[return-value]
                {"error": "rate_limited", "message": str(exc)},
                status_code=429,
                headers={"Retry-After": str(int(exc.retry_after) + 1)},
            )
        except LoginError:
            return JSONResponse(  # type: ignore[return-value]
                {"error": "wrong_code", "message": "wrong code"}, status_code=401
            )
        if master.logins_blocked:
            name = master.state().owner_name
            owner = name or "the master"
            return JSONResponse(  # type: ignore[return-value]
                {
                    "error": "logins_blocked",
                    "message": f"New connections are blocked by {owner}",
                    "owner": name,  # for the UI's own words
                },
                status_code=403,
            )
        client = auth.open_session(body.name, read_only=read_only)
        response.set_cookie(
            SESSION_COOKIE,
            client.token,
            httponly=True,
            samesite="strict",
            path="/",
            secure=config.tls,
        )
        return {
            "client_id": client.client_id,
            "name": client.name,
            "read_only": client.read_only,
            "token": client.token,  # for a frontend on another origin (no cookie there)
        }

    @app.post("/api/logout")
    async def logout(request: Request, response: Response) -> dict[str, bool]:
        client = auth.logout(request_token(request))
        if client is not None:
            lock.release(client.client_id)
            master.release(client.client_id)
            await hub.close_client_sessions(client.client_id)
        response.delete_cookie(SESSION_COOKIE, path="/")
        return {"ok": True}

    @app.get("/api/session")
    async def current_session(request: Request) -> JSONResponse:
        client = auth.get(request_token(request))
        if client is None:
            return JSONResponse({"authenticated": False}, status_code=401)
        return JSONResponse(
            {
                "authenticated": True,
                "client_id": client.client_id,
                "name": client.name,
                "read_only": client.read_only,
            }
        )

    @app.get("/api/health")
    async def health() -> dict[str, Any]:
        return {
            "status": "ok",
            "device_status": devices.default.session.status.value,  # the first DSP
            "devices": [
                {"id": d.id, "status": d.session.status.value, "demo": d.spec.demo} for d in devices
            ],
            "version": __version__,
            "demo": all(d.spec.demo for d in devices),  # no real DSP at all
        }

    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket) -> None:
        token = websocket_token(websocket)
        if token is None:  # the cookie: only from this server's own pages
            if not _origin_allowed(websocket):
                await websocket.close(code=4403)
                return
            client = auth.get(websocket.cookies.get(SESSION_COOKIE))
        else:  # the login's token, sent explicitly: from any origin
            client = auth.get(token)
        # The browser fails the handshake unless one of the offered subprotocols is selected.
        subprotocol = WS_PROTOCOL if token is not None else None
        if client is None:
            # Accept first: a close before the handshake reaches the browser as a bare HTTP 403
            # (close code 1006), and it would keep reconnecting instead of showing the login
            # (a restarted server has forgotten every session).
            await websocket.accept(subprotocol=subprotocol)
            await websocket.close(code=4401)
            return
        await websocket.accept(subprotocol=subprotocol)
        # ?device=NAME: the DSP this socket controls (the first one when unknown or missing:
        # the hello says which one it got).
        device = devices.get(websocket.query_params.get("device")) or devices.default
        await hub.serve(websocket, client, device)

    @app.get("/{path:path}", include_in_schema=False)
    async def static(path: str) -> Response:
        index = web_root / "index.html"
        if not index.is_file():
            return HTMLResponse(PLACEHOLDER_HTML)
        candidate = (web_root / path).resolve()
        if path and candidate.is_file() and candidate.is_relative_to(web_root.resolve()):
            return FileResponse(candidate)
        return FileResponse(index, headers={"Cache-Control": "no-cache"})

    return app


async def _ticker(lock: LockManager, master: MasterManager) -> None:
    while True:
        await asyncio.sleep(LOCK_TICK_S)
        lock.expire()
        master.expire()
