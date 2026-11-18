"""Unsaved changes: the differences between a stored preset (reference) and the live state."""

import pytest

from tests.state.test_state import forest_state
from tracks_dsp_controller.state.changes import changes, same_config
from tracks_dsp_controller.state.models import DeviceState


def edited(state: DeviceState) -> DeviceState:
    live = state.model_copy(deep=True)
    live.outputs[2].gain_db = -6.0
    live.inputs[0].peq[1].freq_hz = 315.0
    live.inputs[1].geq[4] = 3.0
    live.outputs[0].compressor.threshold_db = 4.0
    live.outputs[1].matrix = [not on for on in live.outputs[1].matrix]
    live.outputs[3].crossover.hpf.freq_hz = 100.0
    live.outputs[3].crossover.hpf.enabled = not state.outputs[3].crossover.hpf.enabled
    live.outputs[4].linked = [5]
    return live


def test_no_change() -> None:
    state = forest_state()
    assert changes(state, state.model_copy(deep=True)) == []
    assert same_config(state, state)


def test_one_change_per_parameter_with_its_revert() -> None:
    reference = forest_state()
    live = edited(reference)
    found = {c.path: c for c in changes(reference, live)}
    gain = found["outputs.2.gain_db"]
    assert (gain.before, gain.after) == (reference.outputs[2].gain_db, -6.0)
    assert gain.revert == ("outputs.2.gain_db", reference.outputs[2].gain_db)
    # A PEQ band, a filter, the dynamics: the write merges a partial object.
    band = found["inputs.0.peq.1.freq_hz"]
    assert band.revert == ("inputs.0.peq.1", {"freq_hz": reference.inputs[0].peq[1].freq_hz})
    assert found["outputs.0.compressor.threshold_db"].revert == (
        "outputs.0.compressor",
        {"threshold_db": reference.outputs[0].compressor.threshold_db},
    )
    assert found["outputs.3.crossover.hpf.enabled"].revert == (
        "outputs.3.crossover.hpf",
        {"enabled": reference.outputs[3].crossover.hpf.enabled},
    )
    assert found["inputs.1.geq.4"].revert == ("inputs.1.geq.4", reference.inputs[1].geq[4])
    # The matrix is written whole.
    assert found["outputs.1.matrix"].revert == ("outputs.1.matrix", reference.outputs[1].matrix)
    # Links have their own request: shown, not reverted here.
    assert found["outputs.4.linked"].revert is None
    assert not same_config(reference, live)
    assert found["inputs.0.peq.1.freq_hz"].as_dict()["revert"] == {
        "path": "inputs.0.peq.1",
        "value": {"freq_hz": reference.inputs[0].peq[1].freq_hz},
    }


def test_not_a_change() -> None:
    reference = forest_state()
    live = reference.model_copy(deep=True)
    live.modified = True
    live.preset_name = "Other"  # not part of the comparison (the slot's name)
    live.outputs[2].gain_db = reference.outputs[2].gain_db + 1e-9  # float noise
    # A bypassed filter's slope is only remembered by this app.
    live.outputs[6].crossover.lpf.enabled = False
    ref = reference.model_copy(deep=True)
    ref.outputs[6].crossover.lpf.enabled = False
    live.outputs[6].crossover.lpf.slope = ref.outputs[6].crossover.lpf.slope + 1
    assert changes(ref, live) == []


def test_another_model() -> None:
    reference = forest_state()
    live = reference.model_copy(deep=True)
    live.outputs = live.outputs[:6]
    with pytest.raises(ValueError, match="another model"):
        changes(reference, live)
