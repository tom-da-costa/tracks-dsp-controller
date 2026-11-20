"""Mute all (issue #72): every output of every DSP, from anyone with a full session, ahead of
the queued writes; restore unmutes only what was on; an offline DSP is muted when it returns."""

import time
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from starlette.testclient import WebSocketTestSession

from tracks_dsp_controller.protocol.profile import DEFAULT_PROFILE
from tracks_dsp_controller.server.app import create_app
from tracks_dsp_controller.server.devices import Device
from tracks_dsp_controller.server.settings import DspSpec, ServerConfig

from .test_multi_dsp import ctx_of, wait_all_online
from .test_server import login, receive_until, request


@pytest.fixture
def two(tmp_path: Path) -> Iterator[TestClient]:
    (tmp_path / "index.html").write_text("<!doctype html><title>UI</title>")
    config = ServerConfig(
        [DspSpec("main", "demo"), DspSpec("delay", "demo", model="206")],
        pin="4321",
        view_pin="999999",
        meter_rate_hz=10,
    )
    app = create_app(config, DEFAULT_PROFILE, web_dir=tmp_path)
    with TestClient(app) as client:
        wait_all_online(app.state.ctx)
        yield client


def mutes(device: Device) -> list[bool]:
    assert device.simulator is not None
    return [output.mute for output in device.simulator.device.live.outputs]


def wait_for(condition: object, timeout: float = 5) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if callable(condition) and condition():
            return
        time.sleep(0.02)
    raise AssertionError("timed out")


def next_panic(ws: WebSocketTestSession, until: Callable[[dict[str, Any]], bool]) -> dict[str, Any]:
    """The next ``panic`` message that satisfies ``until`` (earlier ones are skipped)."""
    for _ in range(50):
        panic = receive_until(ws, "panic")
        if until(panic):
            return panic
    raise AssertionError("no such panic message")


def test_mute_all_then_restore(two: TestClient) -> None:
    ctx = ctx_of(two)
    main, delay = list(ctx.devices)
    login(two, "Alice")
    with two.websocket_connect("/ws?device=main") as alice:
        login(two, "Bob")
        with two.websocket_connect("/ws?device=delay") as bob:
            assert receive_until(bob, "panic") == {"type": "panic", "active": False}
            assert request(
                alice, {"type": "set", "req": 1, "path": "outputs.2.mute", "value": True}
            )["ok"]
            assert request(alice, {"type": "lock.acquire", "req": 2})["ok"]
            # Bob has no control, his screen is locked: he can still mute everything
            assert request(bob, {"type": "screen.lock", "req": 3})["ok"]
            result = request(bob, {"type": "panic", "req": 4})
            assert result["ok"]
            assert result["dsps"] == {"main": "muted", "delay": "muted"}
            assert all(mutes(main))
            assert all(mutes(delay))
            assert all(o.mute for o in main.store.state.outputs)
            panic = next_panic(alice, lambda p: p["active"])
            assert panic["by"] == "Bob"
            assert panic["dsps"] == [
                {"id": "main", "status": "muted", "restorable": True},
                {"id": "delay", "status": "muted", "restorable": True},
            ]
            # nothing is refused afterwards: it is an action, not a mode
            assert request(
                alice, {"type": "set", "req": 5, "path": "outputs.0.gain_db", "value": -3}
            )["ok"]
            # restoring brings sound back: it needs control
            assert request(bob, {"type": "screen.unlock", "req": 6, "pin": "4321"})["ok"]
            assert request(bob, {"type": "panic.restore", "req": 7})["error"] == "locked"
            restored = request(alice, {"type": "panic.restore", "req": 8})
            assert restored["dsps"] == {"main": "restored", "delay": "restored"}
            assert mutes(main) == [False, False, True, False, False, False, False, False]
            assert not any(mutes(delay))
            next_panic(bob, lambda p: not p["active"])


def test_read_only_cannot_mute_all(two: TestClient) -> None:
    two.post("/api/login", json={"pin": "999999", "name": "Guest"})
    with two.websocket_connect("/ws") as guest:
        assert request(guest, {"type": "panic", "req": 1})["error"] == "read_only"
    assert not any(mutes(ctx_of(two).devices.default))


def test_a_recalled_preset_is_not_restored_over(two: TestClient) -> None:
    ctx = ctx_of(two)
    main, _ = list(ctx.devices)
    login(two)
    with two.websocket_connect("/ws") as ws:
        assert request(ws, {"type": "panic", "req": 1})["ok"]
        assert request(ws, {"type": "preset.recall", "req": 2, "slot": 2})["ok"]
        next_panic(ws, lambda p: p["active"] and not p["dsps"][0]["restorable"])
        before = mutes(main)
        assert request(ws, {"type": "panic.restore", "req": 3})["dsps"] == {"delay": "restored"}
        assert mutes(main) == before
        # dismissing forgets a panic without unmuting
        assert request(ws, {"type": "panic", "req": 4})["ok"]
        assert request(ws, {"type": "panic.dismiss", "req": 5})["ok"]
        assert ctx.hub.panic.record is None
        assert all(mutes(main))


def test_an_offline_dsp_is_muted_when_it_comes_back(two: TestClient) -> None:
    ctx = ctx_of(two)
    _, delay = list(ctx.devices)
    simulator = delay.simulator
    assert simulator is not None
    assert two.portal is not None
    delay.session.reconnect_min_s = delay.session.reconnect_max_s = 0.05
    simulator.port = simulator.bound_port  # restarts on the same port
    two.portal.call(simulator.stop)
    wait_for(lambda: delay.session.status.value == "offline")
    login(two)
    with two.websocket_connect("/ws") as ws:
        result = request(ws, {"type": "panic", "req": 1})
        assert result["dsps"] == {"main": "muted", "delay": "pending"}
        assert not any(mutes(delay))
        two.portal.call(simulator.start)
        wait_for(lambda: all(mutes(delay)))
        panic = next_panic(ws, lambda p: p["active"] and p["dsps"][1]["status"] == "muted")
        assert panic["dsps"][1]["restorable"]
        assert request(ws, {"type": "panic.restore", "req": 2})["ok"]
        assert not any(mutes(delay))
