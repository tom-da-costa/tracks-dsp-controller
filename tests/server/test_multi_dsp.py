"""DSPs of a server (issue #32): ``--dsp`` configuration (one DSP is just the case n = 1, and
``demo`` in place of the address simulates one), one WebSocket per DSP, per-DSP state and
meters, server-wide control, the overview of every DSP."""

import time
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tracks_dsp_controller import cli
from tracks_dsp_controller.protocol.profile import DEFAULT_PROFILE
from tracks_dsp_controller.server.app import AppContext, create_app
from tracks_dsp_controller.server.settings import DspSpec, ServerConfig, parse_dsp, parse_dsps

from .test_server import login, receive_until, request


# --- configuration -------------------------------------------------------------------------------
def test_parse_dsp() -> None:
    assert parse_dsp("192.168.1.50") == DspSpec("dsp", "192.168.1.50")  # no name: "dsp"
    assert parse_dsp("main=192.168.1.50") == DspSpec("main", "192.168.1.50")
    assert parse_dsp("delay=206@10.0.0.7:9000/3") == DspSpec("delay", "10.0.0.7", 9000, 3, "206")
    assert parse_dsp("mon=dsp.local/12") == DspSpec("mon", "dsp.local", 9761, 12)
    assert parse_dsp("v6=[fe80::1]:9762") == DspSpec("v6", "fe80::1", 9762)
    assert parse_dsp("v6=fe80::1") == DspSpec("v6", "fe80::1")
    # the defaults come from --device-id and --model
    spec = parse_dsp("a=h", device_id=4, model="204")
    assert spec == DspSpec("a", "h", 9761, 4, "204")
    assert parse_dsp("a=408@h/9", device_id=4, model="204") == DspSpec("a", "h", 9761, 9, "408")
    # demo in place of the address: a simulated DSP
    assert parse_dsp("demo").demo
    assert parse_dsp("delay=206@demo") == DspSpec("delay", "demo", model="206")
    assert parse_dsp("x=DEMO").target == "demo"
    assert not parse_dsp("10.0.0.1").demo
    assert parse_dsp("10.0.0.1:9000").target == "10.0.0.1:9000"
    for bad, match in [
        ("", "address"),
        ("a=", "address"),
        ("a=206@", "address"),
        ("=10.0.0.1", "name"),
        ("bad name=10.0.0.1", "name"),
        ("a=h:port", "port"),
        ("a=h:0", "port"),
        ("a=h/x", "device ID"),
        ("a=h/251", "device ID"),
        ("a=306@h", "model"),
    ]:
        with pytest.raises(ValueError, match=match):
            parse_dsp(bad)
    # TDSP_DSP holds several, separated by spaces or commas; unnamed ones get dsp, dsp2…
    specs = parse_dsps(["main=10.0.0.1, delay=10.0.0.2  10.0.0.3", "10.0.0.4"])
    assert [s.name for s in specs] == ["main", "delay", "dsp", "dsp2"]
    assert parse_dsps([""]) == []


def test_config_dsps() -> None:
    with pytest.raises(ValueError, match="--dsp is required"):
        ServerConfig()
    two = [DspSpec("main", "10.0.0.1"), DspSpec("delay", "demo")]
    assert ServerConfig(two).dsps == two  # a real DSP and a simulated one, mixed
    with pytest.raises(ValueError, match="own name"):
        ServerConfig([DspSpec("main", "a"), DspSpec("MAIN", "b")])
    with pytest.raises(ValueError, match="own name"):
        ServerConfig(parse_dsps(["dsp=10.0.0.1", "10.0.0.2"]))


def test_cli_reads_dsp_options(monkeypatch: pytest.MonkeyPatch) -> None:
    configs: list[ServerConfig] = []

    def fake_create_app(config: ServerConfig, *args: Any, **kwargs: Any) -> Any:
        configs.append(config)
        raise RuntimeError("stop here")

    monkeypatch.setattr("tracks_dsp_controller.server.app.create_app", fake_create_app)
    assert cli.main(["--dsp", "10.0.0.1"]) == 1
    assert configs[-1].dsps == [DspSpec("dsp", "10.0.0.1")]
    argv = ["--dsp", "main=10.0.0.1", "--dsp", "delay=10.0.0.2:9000/3", "--model", "206"]
    assert cli.main(argv) == 1
    assert configs[-1].dsps == [
        DspSpec("main", "10.0.0.1", model="206"),
        DspSpec("delay", "10.0.0.2", 9000, 3, "206"),
    ]
    assert cli.main(["--dsp", "demo"]) == 1
    assert configs[-1].dsps[0].demo
    # TDSP_DSP, replaced (not extended) by --dsp
    monkeypatch.setenv("TDSP_DSP", "a=10.0.0.5 b=demo")
    assert cli.main(["serve"]) == 1
    assert [s.name for s in configs[-1].dsps] == ["a", "b"]
    assert cli.main(["--dsp", "c=10.0.0.7"]) == 1
    assert [s.name for s in configs[-1].dsps] == ["c"]


# --- two simulated DSPs -------------------------------------------------------------------------
def wait_all_online(ctx: AppContext) -> None:
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        if all(d.session.status.value == "online" for d in ctx.devices):
            return
        time.sleep(0.02)
    raise AssertionError("not every DSP came online")


@pytest.fixture
def two(tmp_path: Path) -> Iterator[TestClient]:
    (tmp_path / "index.html").write_text("<!doctype html><title>UI</title>")
    config = ServerConfig(
        [DspSpec("main", "demo"), DspSpec("delay", "demo", model="206")],
        pin="4321",
        meter_rate_hz=10,
    )
    app = create_app(config, DEFAULT_PROFILE, web_dir=tmp_path)
    with TestClient(app) as client:
        wait_all_online(app.state.ctx)
        yield client


def ctx_of(client: TestClient) -> AppContext:
    ctx: AppContext = client.app.state.ctx  # type: ignore[attr-defined]
    return ctx


def test_each_socket_controls_one_dsp(two: TestClient) -> None:
    ctx = ctx_of(two)
    main, delay = list(ctx.devices)
    assert (main.session.model_key, delay.session.model_key) == ("408", "206")
    health = two.get("/api/health").json()
    assert health["devices"] == [
        {"id": "main", "status": "online", "demo": True},
        {"id": "delay", "status": "online", "demo": True},
    ]
    assert health["demo"] is True  # every DSP is simulated
    login(two)
    with two.websocket_connect("/ws?device=delay") as ws:
        hello = receive_until(ws, "hello")
        assert hello["device_id"] == "delay"
        assert hello["profile"]["output_count"] == 6
        overview = receive_until(ws, "devices")["devices"]
        assert [(d["id"], d["status"], d["model"]) for d in overview] == [
            ("main", "online", "DSP408"),
            ("delay", "online", "DSP206"),
        ]
        assert len(receive_until(ws, "snapshot")["state"]["outputs"]) == 6
        assert receive_until(ws, "device")["model"] == "DSP206"
        assert len(receive_until(ws, "meters")["levels"]) == 8  # 2 inputs + 6 outputs
        assert request(ws, {"type": "set", "req": 1, "path": "outputs.5.mute", "value": True})["ok"]
        assert delay.store.state.outputs[5].mute
        assert len(main.store.state.outputs) == 8
        assert not main.store.state.outputs[5].mute
    # no device, or one that does not exist: the first one
    for url in ("/ws", "/ws?device=gone"):
        with two.websocket_connect(url) as ws:
            assert receive_until(ws, "hello")["device_id"] == "main"


def test_patches_stay_with_their_dsp_and_control_covers_them_all(two: TestClient) -> None:
    ctx = ctx_of(two)
    main, delay = list(ctx.devices)
    login(two, "Alice")
    alice_cookie = two.cookies["dsp408_session"]
    with two.websocket_connect("/ws?device=main") as alice:
        login(two, "Bob")
        with two.websocket_connect("/ws?device=delay") as bob:
            alice_id = receive_until(alice, "hello")["client_id"]
            bob_id = receive_until(bob, "hello")["client_id"]
            clients = receive_until(alice, "clients")
            while len(clients["clients"]) < 2:
                clients = receive_until(alice, "clients")
            assert {c["name"]: c["devices"] for c in clients["clients"]} == {
                "Alice": ["main"],
                "Bob": ["delay"],
            }

            assert request(bob, {"type": "set", "req": 1, "path": "inputs.1.mute", "value": True})[
                "ok"
            ]
            # Bob only gets the delay line's patches
            patch = receive_until(bob, "patch")
            assert {"path": "inputs.1.mute", "value": True} in patch["changes"]
            assert delay.store.state.inputs[1].mute
            assert not main.store.state.inputs[1].mute
            # a recall shows in everyone's overview
            assert request(alice, {"type": "preset.recall", "req": 2, "slot": 2})["ok"]
            overview = receive_until(bob, "devices")["devices"]
            while overview[0]["active_slot"] != 2:
                overview = receive_until(bob, "devices")["devices"]
            # the meter rate is set per DSP
            assert request(bob, {"type": "settings.set", "req": 3, "meter_rate_hz": 2})["ok"]
            assert delay.session.meter_rate_hz == 2
            assert main.session.meter_rate_hz == 10

            # Control belongs to the server: Alice, on main, makes Bob read-only on the delay
            # line too, and every socket hears of it
            assert request(alice, {"type": "lock.acquire", "req": 4})["ok"]
            assert ctx.lock.state().owner_id == alice_id
            lock = receive_until(bob, "lock")
            while lock["owner_id"] is None:
                lock = receive_until(bob, "lock")
            assert lock["owner_name"] == "Alice"
            denied = request(
                bob, {"type": "set", "req": 5, "path": "inputs.1.mute", "value": False}
            )
            assert denied["error"] == "locked"
            assert request(bob, {"type": "lock.acquire", "req": 6})["error"] == "locked"
            assert (
                request(bob, {"type": "settings.set", "req": 7, "meter_rate_hz": 4})["error"]
                == "locked"
            )
            # Alice writes to the delay line from another tab
            two.cookies.set("dsp408_session", alice_cookie)
            with two.websocket_connect("/ws?device=delay") as alice_delay:
                assert request(
                    alice_delay, {"type": "set", "req": 1, "path": "inputs.1.mute", "value": False}
                )["ok"]
            assert not delay.store.state.inputs[1].mute
            # nobody else may shut the server down while Alice has control
            ctx.hub.request_exit = lambda: None
            assert request(bob, {"type": "server.shutdown", "req": 8})["error"] == "locked"
            # the master's kick releases the control its target held
            assert request(alice, {"type": "lock.release", "req": 9})["ok"]
            assert request(bob, {"type": "lock.acquire", "req": 10})["ok"]
            assert request(alice, {"type": "master.acquire", "req": 11})["ok"]
            assert request(alice, {"type": "client.kick", "req": 12, "client_id": bob_id})["ok"]
            assert ctx.lock.state().owner_id is None


def test_logout_releases_control(two: TestClient) -> None:
    ctx = ctx_of(two)
    login(two, "Alice")
    with two.websocket_connect("/ws?device=delay") as ws:
        assert request(ws, {"type": "lock.acquire", "req": 1})["ok"]
    assert ctx.lock.state().owner_name == "Alice"
    assert two.post("/api/logout").json() == {"ok": True}
    assert ctx.lock.state().owner_id is None
