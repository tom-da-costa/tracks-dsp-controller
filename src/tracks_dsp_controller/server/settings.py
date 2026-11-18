"""Server configuration (from the CLI / environment) and live settings."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

DEFAULT_PIN = "0000"
DEFAULT_DSP_PORT = 9761
MODEL_CHOICES = ("auto", "408", "206", "204")
# In place of a DSP's address: a simulated DSP runs inside this process.
DEMO_HOST = "demo"
# The name of a DSP given without one: "dsp", then "dsp2", "dsp3"…
DEFAULT_DSP_NAME = "dsp"
# A DSP's name is its id in the API (/ws?device=NAME) and its label in the UI.
DSP_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,23}")


@dataclass(frozen=True)
class DspSpec:
    """One DSP to control: ``--dsp [NAME=][MODEL@]HOST[:PORT][/ID]``; ``HOST`` may be ``demo``."""

    name: str
    host: str
    port: int = DEFAULT_DSP_PORT
    device_id: int | None = None  # the ID number set on the DSP; None = search for it
    model: str = "auto"

    def __post_init__(self) -> None:
        if not DSP_NAME.fullmatch(self.name):
            raise ValueError(
                f"DSP name {self.name!r}: 1-24 letters, digits, '.', '_' or '-' "
                "(starting with a letter or a digit)"
            )
        if not self.host:
            raise ValueError(f"DSP {self.name}: the address is required (or demo)")
        if not 1 <= self.port <= 65535:
            raise ValueError(f"DSP {self.name}: the port must be 1-65535")
        if self.device_id is not None and not 1 <= self.device_id <= 250:
            raise ValueError(f"DSP {self.name}: the device ID must be 1-250")
        if self.model not in MODEL_CHOICES:
            raise ValueError(f"DSP {self.name}: the model must be auto, 408, 206 or 204")

    @property
    def demo(self) -> bool:
        """A simulated DSP, inside this process (``demo`` in place of the address)."""
        return self.host.lower() == DEMO_HOST

    @property
    def target(self) -> str:
        return DEMO_HOST if self.demo else f"{self.host}:{self.port}"


def parse_dsp(
    text: str,
    *,
    name: str = DEFAULT_DSP_NAME,
    device_id: int | None = None,
    model: str = "auto",
) -> DspSpec:
    """Parse ``[NAME=][MODEL@]HOST[:PORT][/ID]``; the keyword arguments are the defaults."""
    rest = text.strip()
    if "=" in rest:
        name, _, rest = rest.partition("=")
    if "@" in rest:
        model, _, rest = rest.partition("@")
    if "/" in rest:
        rest, _, id_text = rest.partition("/")
        device_id = _number(id_text, f"DSP {name}: the device ID")
    host, port = rest, DEFAULT_DSP_PORT
    if rest.startswith("["):  # [IPv6]:port
        host, _, port_text = rest[1:].partition("]")
        if port_text:
            port = _number(port_text.removeprefix(":"), f"DSP {name}: the port")
    elif rest.count(":") == 1:  # not an IPv6 address without a port
        host, _, port_text = rest.partition(":")
        port = _number(port_text, f"DSP {name}: the port")
    return DspSpec(name, host, port, device_id, model or "auto")


def parse_dsps(
    items: list[str], *, device_id: int | None = None, model: str = "auto"
) -> list[DspSpec]:
    """Parse the ``--dsp`` values; one value may hold several, separated by commas or spaces
    (the ``TDSP_DSP`` environment variable). DSPs without a name get ``dsp``, ``dsp2``…"""
    specs = []
    unnamed = 0
    for item in items:
        for part in re.split(r"[,\s]+", item):
            if not part:
                continue
            name = DEFAULT_DSP_NAME
            if "=" not in part:
                unnamed += 1
                name = DEFAULT_DSP_NAME if unnamed == 1 else f"{DEFAULT_DSP_NAME}{unnamed}"
            specs.append(parse_dsp(part, name=name, device_id=device_id, model=model))
    return specs


def _number(text: str, what: str) -> int:
    try:
        return int(text)
    except ValueError:
        raise ValueError(f"{what} must be a number, not {text!r}") from None


@dataclass
class ServerConfig:
    # The DSPs to control, in the order given (--dsp, repeatable): at least one.
    dsps: list[DspSpec] = field(default_factory=list)
    host: str = "0.0.0.0"
    port: int = 8080
    pin: str = DEFAULT_PIN
    meter_rate_hz: float = 5.0
    lock_idle_timeout_s: float = 120.0
    resync_interval_s: float = 0.0  # 0 = off
    command_timeout_s: float | None = None
    experimental: bool = False
    demo_scenario: str = "demo"  # presets and signals of the simulated (demo) DSPs
    tls: bool = False  # served over HTTPS: the session cookie is Secure

    def __post_init__(self) -> None:
        if not self.dsps:
            raise ValueError("--dsp is required: the DSP's address, or demo (repeatable)")
        if not self.pin:
            raise ValueError("the access code must not be empty")
        if self.lock_idle_timeout_s <= 0:
            raise ValueError("--lock-idle-timeout must be > 0")
        if self.resync_interval_s < 0:
            raise ValueError("--resync-interval must be >= 0")
        names = [spec.name.lower() for spec in self.dsps]
        if len(set(names)) != len(names):
            raise ValueError("every --dsp needs its own name (NAME=…)")

    def allow_unverified(self, spec: DspSpec) -> bool:
        """Unverified parameters are allowed on a simulated DSP, or with --experimental."""
        return spec.demo or self.experimental
