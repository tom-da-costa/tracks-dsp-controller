"""The DSPs this server controls: one ``DeviceSession`` + ``StateStore`` + control lock each.

``DeviceManager`` keeps them in the order given on the command line; the first one is the
default (a client that names no device, or one that no longer exists, gets it). Each DSP accepts
a single TCP client (PROTOCOL.md §1), so there is one connection per DSP, as with a single one.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import Callable, Iterator
from dataclasses import dataclass

from tracks_dsp_controller.device.session import DeviceSession
from tracks_dsp_controller.protocol.profile import MODELS, ProtocolProfile, detect_model
from tracks_dsp_controller.server.lock import LockManager
from tracks_dsp_controller.server.settings import DspSpec, ServerConfig
from tracks_dsp_controller.simulator import Faults, SimulatedDevice, SimulatorServer, apply_scenario
from tracks_dsp_controller.simulator.models import SIM_MODELS
from tracks_dsp_controller.state.store import StateStore

log = logging.getLogger(__name__)

type ModelProfile = Callable[[str], ProtocolProfile]


@dataclass(eq=False)
class Device:
    """One DSP: its connection, its state mirror and who has control of it."""

    spec: DspSpec
    session: DeviceSession
    store: StateStore
    lock: LockManager
    simulator: SimulatorServer | None = None

    @property
    def id(self) -> str:
        return self.spec.name

    async def start(self) -> None:
        if self.simulator is not None:
            await self.simulator.start()
            # The simulator's port is only known once it runs.
            self.session.host = "127.0.0.1"
            self.session.port = self.simulator.bound_port
        await self.session.start()

    async def stop(self) -> None:
        await self.session.stop()
        if self.simulator is not None:
            await self.simulator.stop()


class DeviceManager:
    def __init__(self, devices: list[Device]) -> None:
        if not devices:
            raise ValueError("no DSP to control")
        self._devices = {device.id: device for device in devices}

    def __iter__(self) -> Iterator[Device]:
        return iter(self._devices.values())

    def __len__(self) -> int:
        return len(self._devices)

    @property
    def default(self) -> Device:
        return next(iter(self._devices.values()))

    def get(self, device_id: str | None) -> Device | None:
        return None if device_id is None else self._devices.get(device_id)

    async def start(self) -> None:
        for device in self:
            await device.start()

    async def stop(self) -> None:
        # Concurrently: each one closes its own TCP connection.
        await asyncio.gather(*(device.stop() for device in self))

    async def resync_loop(self, interval: float) -> None:
        while True:
            await asyncio.sleep(interval)
            for device in self:
                with contextlib.suppress(Exception):
                    await device.session.resync()


def build_devices(
    config: ServerConfig,
    profile: ProtocolProfile,
    model_profile: ModelProfile,
    *,
    simulated_device: SimulatedDevice | None = None,
) -> DeviceManager:
    """A ``Device`` per DSP of the configuration; in demo mode each one gets its own simulator
    (``simulated_device``, for the tests, replaces the first one's)."""
    devices = []
    for index, spec in enumerate(config.devices):
        # The profile until the device is identified: its --model, or the base one.
        start = profile
        if spec.model in MODELS and detect_model(profile.model) != spec.model:
            start = model_profile(spec.model)
        simulator = None
        if config.demo:
            # The simulated model: --model, or the profile's (408 by default) with auto.
            key = spec.model if spec.model in MODELS else detect_model(start.model) or "408"
            sim_profile = start if key == detect_model(start.model) else model_profile(key)
            given = simulated_device if index == 0 else None
            device = given or SimulatedDevice(sim_profile, model=SIM_MODELS[key])
            faults = Faults()
            if given is None:
                apply_scenario(config.demo_scenario, device, faults)
            simulator = SimulatorServer(
                device, host="127.0.0.1", port=0, faults=faults, device_id=spec.device_id
            )
        store = StateStore()
        session = DeviceSession(
            spec.host or "127.0.0.1",
            spec.port,
            start,
            store,
            meter_rate_hz=config.meter_rate_hz,
            model=spec.model,
            profile_for=model_profile,
            device_id=spec.device_id,
        )
        lock = LockManager(config.lock_idle_timeout_s)
        devices.append(Device(spec, session, store, lock, simulator))
    return DeviceManager(devices)
