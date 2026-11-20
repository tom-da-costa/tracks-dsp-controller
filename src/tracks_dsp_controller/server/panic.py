"""Mute all (panic): one gesture mutes every output of every DSP, ahead of the queued writes.

The panic is an action, not a mode: nothing is refused afterwards. The server remembers, per
DSP, whether each output was muted before, so that "restore" unmutes only the outputs that were
on. A DSP the mute could not reach (offline, no answer) is muted when it comes back online. The
record lasts until someone restores or dismisses it; a preset recall or import on a DSP drops
that DSP's "before" (its preset now decides), and so does a preset recalled from the front
panel (the active slot changed).
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

from tracks_dsp_controller.device.pipeline import CommandTimeoutError, PipelineClosedError
from tracks_dsp_controller.device.session import DeviceStatus, DeviceUnavailableError
from tracks_dsp_controller.server.devices import Device, DeviceManager

log = logging.getLogger(__name__)


class PanicStatus(StrEnum):
    MUTED = "muted"
    PENDING = "pending"  # offline: muted when it comes back
    FAILED = "failed"  # no answer: retried when it comes back online


@dataclass
class DspPanic:
    status: PanicStatus = PanicStatus.PENDING
    before: list[bool] | None = None  # each output's mute before the panic
    slot: int | None = None  # the active preset then

    @property
    def restorable(self) -> bool:
        return self.before is not None and not all(self.before)


@dataclass
class PanicRecord:
    by_id: str
    by_name: str
    at: float
    dsps: dict[str, DspPanic] = field(default_factory=dict)


type PanicListener = Callable[[PanicRecord | None], None]


class PanicManager:
    def __init__(self, devices: DeviceManager) -> None:
        self.devices = devices
        self.record: PanicRecord | None = None
        self._listeners: list[PanicListener] = []
        self._tasks: set[asyncio.Task[None]] = set()

    def on_change(self, listener: PanicListener) -> None:
        self._listeners.append(listener)

    def _changed(self) -> None:
        for listener in list(self._listeners):
            try:
                listener(self.record)
            except Exception:
                log.exception("panic listener failed")

    def message(self) -> dict[str, Any]:
        record = self.record
        if record is None:
            return {"type": "panic", "active": False}
        return {
            "type": "panic",
            "active": True,
            "by_id": record.by_id,
            "by": record.by_name,
            "at": record.at,
            "dsps": [
                {"id": device.id, "status": entry.status.value, "restorable": entry.restorable}
                for device in self.devices
                if (entry := record.dsps.get(device.id)) is not None
            ],
        }

    async def trigger(self, client_id: str, name: str) -> dict[str, str]:
        """Mute every output of every DSP; return each DSP's outcome."""
        log.warning("mute all requested by %s", name)
        if self.record is None:
            self.record = PanicRecord(client_id, name, time.time())
        else:  # again: the outputs' "before" stays the one of the first panic
            self.record.by_id, self.record.by_name, self.record.at = client_id, name, time.time()
        record = self.record
        for device in self.devices:
            record.dsps.setdefault(device.id, DspPanic())
        await asyncio.gather(*(self._mute(device, record, client_id) for device in self.devices))
        self._changed()
        return {d.id: record.dsps[d.id].status.value for d in self.devices}

    async def _mute(self, device: Device, record: PanicRecord, origin: str) -> None:
        entry = record.dsps[device.id]
        session = device.session
        try:
            before = await session.mute_outputs(origin)
        except (DeviceUnavailableError, PipelineClosedError):
            entry.status = PanicStatus.PENDING
            return
        except CommandTimeoutError:
            log.warning("mute all: %s did not answer", device.id)
            entry.status = PanicStatus.FAILED
            return
        if entry.before is None:
            entry.before, entry.slot = before, device.store.state.active_slot
        entry.status = PanicStatus.MUTED

    def device_online(self, device: Device) -> None:
        """A DSP came (back) online: mute it if the panic did not reach it."""
        record = self.record
        if record is None or device.session.status is not DeviceStatus.ONLINE:
            return
        entry = record.dsps.get(device.id)
        if entry is None or entry.status is PanicStatus.MUTED:
            return

        async def mute() -> None:
            await self._mute(device, record, record.by_id)
            if self.record is record:
                log.info("mute all: %s muted on reconnection (%s)", device.id, entry.status)
                self._changed()

        task = asyncio.create_task(mute(), name=f"panic-{device.id}")
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    def forget(self, device: Device) -> None:
        """A preset was loaded on this DSP: its mutes are the preset's now, not to restore."""
        entry = self.record.dsps.get(device.id) if self.record is not None else None
        if entry is not None and entry.before is not None:
            entry.before = None
            self._changed()

    async def restore(self, origin: str, name: str = "") -> dict[str, str]:
        """Unmute the outputs that were on before the panic; the record ends. ``origin``: the
        client id (the patches' origin), ``name``: who, for the log.

        Per DSP: "restored", "offline", "changed" (another preset since), "failed"."""
        record = self.record
        if record is None:
            return {}
        outcome: dict[str, str] = {}
        for device in self.devices:
            entry = record.dsps.get(device.id)
            if entry is None or entry.before is None:
                continue
            outcome[device.id] = await self._restore(device, entry, origin)
        if self.record is record:
            self.record = None
            self._changed()
        log.info("mute all restored by %s: %s", name or origin, outcome)
        return outcome

    @staticmethod
    async def _restore(device: Device, entry: DspPanic, origin: str) -> str:
        session, state = device.session, device.store.state
        if session.status is not DeviceStatus.ONLINE:
            return "offline"
        before = entry.before or []
        if state.active_slot != entry.slot or len(state.outputs) != len(before):
            return "changed"
        done = set[int]()
        try:
            for index, was_muted in enumerate(before):
                if was_muted or index in done or not state.outputs[index].mute:
                    continue
                await session.write(f"outputs.{index}.mute", False, origin)
                done.update(state.outputs[index].linked)  # the DSP unmuted them too
        except (DeviceUnavailableError, PipelineClosedError):
            return "offline"
        except CommandTimeoutError:
            return "failed"
        return "restored"

    def dismiss(self) -> None:
        """Forget the panic without unmuting anything."""
        if self.record is not None:
            self.record = None
            self._changed()

    async def stop(self) -> None:
        for task in list(self._tasks):
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
