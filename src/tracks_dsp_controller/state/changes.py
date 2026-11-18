"""Unsaved changes: what differs between the stored preset and the live setup.

The DSP cannot be asked what its stored preset holds on the 408 (reading a stored preset without
recalling it is only verified on a sibling: docs/PROTOCOL.md §5.2), so the session keeps a
**reference**: the state read right after a recall or written by a store, when the live setup
and the stored preset are the same. The changes are the differences between that reference and
the live state, one per parameter (a PEQ band's frequency, a gate's threshold…), with the write
that brings the stored value back when there is one.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from tracks_dsp_controller.state.models import DeviceState

# Not part of a preset's configuration (or not settable by a write).
NOT_CONFIG = frozenset({"info", "presets", "active_slot", "preset_name", "modified"})
# Fields written as a whole object (a partial dict is merged by the registry).
OBJECT_FIELDS = frozenset({"gate", "compressor", "limiter"})
# Read-only for now: shown, not revertable.
READ_ONLY = frozenset({"crosspoints_db", "linked"})
FLOAT_TOLERANCE = 1e-6


@dataclass(frozen=True)
class Change:
    path: str  # e.g. "outputs.2.peq.3.freq_hz"
    before: Any  # in the stored preset
    after: Any  # live
    # The write that restores ``before`` ("set" path and value), None when there is none.
    revert: tuple[str, Any] | None

    def as_dict(self) -> dict[str, Any]:
        revert = None if self.revert is None else {"path": self.revert[0], "value": self.revert[1]}
        return {"path": self.path, "before": self.before, "after": self.after, "revert": revert}


def config_of(state: DeviceState) -> dict[str, Any]:
    """The parts of the state that a preset stores."""
    return state.model_dump(exclude=set(NOT_CONFIG))


def same_config(a: DeviceState, b: DeviceState) -> bool:
    return not changes(a, b)


def changes(reference: DeviceState, live: DeviceState) -> list[Change]:
    """Every parameter of ``live`` that differs from ``reference``, in state order."""
    if (len(reference.inputs), len(reference.outputs)) != (len(live.inputs), len(live.outputs)):
        raise ValueError("the reference is of another model")
    found: list[Change] = []
    before, after = config_of(reference), config_of(live)
    for side in ("inputs", "outputs"):
        for i, (old, new) in enumerate(zip(before[side], after[side], strict=True)):
            _channel(f"{side}.{i}", old, new, found)
    return found


def _channel(prefix: str, old: dict[str, Any], new: dict[str, Any], found: list[Change]) -> None:
    for field, value in new.items():
        was = old[field]
        path = f"{prefix}.{field}"
        if field == "index":
            continue
        if field in READ_ONLY:
            if not _same(was, value):
                found.append(Change(path, was, value, None))
        elif field == "matrix":
            if not _same(was, value):
                found.append(Change(path, was, value, (path, was)))
        elif field in ("peq", "geq"):
            for n, (a, b) in enumerate(zip(was, value, strict=True)):
                band = f"{path}.{n}"
                if isinstance(b, dict):
                    _object(band, a, b, found)
                elif not _same(a, b):
                    found.append(Change(band, a, b, (band, a)))
        elif field == "crossover":
            for which in ("hpf", "lpf"):
                a, b = was[which], value[which]
                if not (a["enabled"] or b["enabled"]):
                    # A bypassed filter's slope is only remembered by this app, not by the DSP.
                    a, b = {**a, "slope": b["slope"]}, b
                _object(f"{path}.{which}", a, b, found)
        elif field in OBJECT_FIELDS:
            _object(path, was, value, found)
        elif not _same(was, value):
            found.append(Change(path, was, value, (path, was)))


def _object(path: str, old: dict[str, Any], new: dict[str, Any], found: list[Change]) -> None:
    """A field of an object written as a whole: reverted with a partial dict."""
    for key, value in new.items():
        if not _same(old[key], value):
            found.append(Change(f"{path}.{key}", old[key], value, (path, {key: old[key]})))


def _same(a: Any, b: Any) -> bool:
    if isinstance(a, float) or isinstance(b, float):
        if isinstance(a, bool) or isinstance(b, bool):
            return bool(a == b)
        if isinstance(a, int | float) and isinstance(b, int | float):
            return math.isclose(a, b, rel_tol=0, abs_tol=FLOAT_TOLERANCE)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(_same(x, y) for x, y in zip(a, b, strict=True))
    return bool(a == b)


__all__ = ["Change", "changes", "config_of", "same_config"]
