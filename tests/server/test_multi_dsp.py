"""Several DSPs from one server (issue #32): configuration, one WebSocket per DSP, per-DSP
state, meters and control, the overview of every DSP."""

import time
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tracks_dsp_controller import cli
from tracks_dsp_controller.protocol.profile import DEFAULT_PROFILE
from tracks_dsp_controller.server.app import AppContext, create_app
from tracks_dsp_controller.server.settings import (
    SINGLE_DSP_ID,
    DspSpec,
    ServerConfig,
    parse_dsp,
    parse_dsps,
)

from .test_server import login, receive_until, request


# --- configuration -------------------------------------------------------------------------------
def test_parse_dsp() -> None:
    assert parse_dsp("main=192.168.1.50") == DspSpec("main", "192.168.1.50")
    assert parse_dsp("delay=206@10.0.0.7:9000/3") == DspSpec("delay", "10.0.0.7", 9000, 3, "206")
    assert parse_dsp("mon=dsp.local/12") == DspSpec("mon", "dsp.local", 9761, 12)
    assert parse_dsp("v6=[fe80::1]:9762") == DspSpec("v6", "fe80::1", 9762)
    assert parse_dsp("v6=fe80::1") == DspSpec("v6", "fe80::1")
    # the defaults come from --dsp-port, --device-id and --model
    spec = parse_dsp("a=h", port=1000, device_id=4, model="204")
    assert spec == DspSpec("a", "h", 1000, 4, "204")
    assert parse_dsp("a=408@h/9", device_id=4, model="204") == DspSpec("a", "h", 9761, 9, "408")
    # demo mode: no host
    assert parse_dsp("main") == DspSpec("main")
    assert parse_dsp("delay=206@") == DspSpec("delay", None, model="206")
    for bad, match in [
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
    # TDSP_DSP holds several, separated by spaces or commas
    names = [s.name for s in parse_dsps(["main=10.0.0.1, delay=10.0.0.2  mon=10.0.0.3", "x=h"])]
    assert names == ["main", "delay", "mon", "x"]
    assert parse_dsps([""]) == []


def test_config_devices() -> None:
    single = ServerConfig(dsp_host="10.0.0.9", dsp_port=9000, device_id=5, model="206")
    assert single.devices == [DspSpec(SINGLE_DSP_ID, "10.0.0.9", 9000, 5, "206")]
    two = [DspSpec("main", "10.0.0.1"), DspSpec("delay", "10.0.0.2")]
    assert ServerConfig(dsps=two).devices == two
    with pytest.raises(ValueError, match="either"):
        ServerConfig(dsp_host="10.0.0.9", dsps=two)
    with pytest.raises(ValueError, match="own name"):
        ServerConfig(dsps=[DspSpec("main", "a"), DspSpec("MAIN", "b")])
    with pytest.raises(ValueError, match="host is required"):
        ServerConfig(dsps=[DspSpec("main")])
    assert ServerConfig(demo=True, dsps=[DspSpec("main"), DspSpec("delay")]).devices[1].name == (
        "delay"
    )


def test_cli_reads_dsp_options(monkeypatch: pytest.MonkeyPatch) -> None:
    configs: list[ServerConfig] = []

    def fake_create_app(config: ServerConfig, *args: Any, **kwargs: Any) -> Any:
        configs.append(config)
        raise RuntimeError("stop here")

    monkeypatch.setattr("tracks_dsp_controller.server.app.create_app", fake_create_app)
    argv = ["--dsp", "main=10.0.0.1", "--dsp", "delay=206@10.0.0.2/3", "--dsp-port", "9000"]
    assert cli.main(argv) == 1
    assert configs[-1].devices == [
        DspSpec("main", "10.0.0.1", 9000),
        DspSpec("delay", "10.0.0.2", 9000, 3, "206"),
    ]
    # TDSP_DSP, replaced (not extended) by --dsp
    monkeypatch.setenv("TDSP_DSP", "a=10.0.0.5 b=10.0.0.6")
    assert cli.main(["serve"]) == 1
    assert [s.name for s in configs[-1].devices] == ["a", "b"]
    assert cli.main(["--dsp", "c=10.0.0.7"]) == 1
    assert [s.name for s in configs[-1].devices] == ["c"]


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
        demo=True,
        pin="4321",
        meter_rate_hz=10,
        dsps=[DspSpec("main"), DspSpec("delay", model="206")],
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
        {"id": "main", "status": "online"},
        {"id": "delay", "status": "online"},
    ]
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


def test_patches_and_control_stay_with_their_dsp(two: TestClient) -> None:
    ctx = ctx_of(two)
    main, delay = list(ctx.devices)
    login(two, "Alice")
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

            # Alice takes control of main: Bob still controls the delay line
            assert request(alice, {"type": "lock.acquire", "req": 1})["ok"]
            assert main.lock.state().owner_id == alice_id
            assert delay.lock.state().owner_id is None
            overview = receive_until(bob, "devices")["devices"]
            while overview[0]["control"] is None:
                overview = receive_until(bob, "devices")["devices"]
            assert [d["control"] for d in overview] == ["Alice", None]
            assert request(bob, {"type": "set", "req": 2, "path": "inputs.1.mute", "value": True})[
                "ok"
            ]
            # Bob only gets the delay line's patches
            patch = receive_until(bob, "patch")
            assert {"path": "inputs.1.mute", "value": True} in patch["changes"]
            assert not main.store.state.inputs[1].mute
            assert request(bob, {"type": "lock.acquire", "req": 3})["ok"]  # the delay line's
            # a recall shows in everyone's overview
            assert request(alice, {"type": "preset.recall", "req": 4, "slot": 2})["ok"]
            overview = receive_until(bob, "devices")["devices"]
            while overview[0]["active_slot"] != 2:
                overview = receive_until(bob, "devices")["devices"]
            # the meter rate is set per DSP
            assert request(bob, {"type": "settings.set", "req": 5, "meter_rate_hz": 2})["ok"]
            assert delay.session.meter_rate_hz == 2
            assert main.session.meter_rate_hz == 10
            # nobody else may shut the server down while holding control of a DSP
            ctx.hub.request_exit = lambda: None
            denied = request(alice, {"type": "server.shutdown", "req": 6})
            assert denied["error"] == "locked"
            assert "delay" in denied["message"]
            # the master's kick releases every control its target held
            assert request(alice, {"type": "master.acquire", "req": 7})["ok"]
            assert delay.lock.state().owner_id == bob_id
            assert request(alice, {"type": "client.kick", "req": 8, "client_id": bob_id})["ok"]
            assert delay.lock.state().owner_id is None
            assert main.lock.state().owner_id == alice_id


def test_logout_releases_control_of_every_dsp(two: TestClient) -> None:
    ctx = ctx_of(two)
    login(two, "Alice")
    for device in ("main", "delay"):
        with two.websocket_connect(f"/ws?device={device}") as ws:
            assert request(ws, {"type": "lock.acquire", "req": 1})["ok"]
    assert all(d.lock.state().owner_name == "Alice" for d in ctx.devices)
    assert two.post("/api/logout").json() == {"ok": True}
    assert all(d.lock.state().owner_id is None for d in ctx.devices)
