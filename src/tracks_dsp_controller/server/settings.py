"""Server configuration (from the CLI / environment) and live settings."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

DEFAULT_PIN = "0000"
DEFAULT_DSP_PORT = 9761
MODEL_CHOICES = ("auto", "408", "206", "204")
# The id of the DSP when only --dsp-host is given.
SINGLE_DSP_ID = "dsp"
# A DSP's name is its id in the API (/ws?device=NAME) and its label in the UI.
DSP_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,23}")


@dataclass(frozen=True)
class DspSpec:
    """One DSP to control: ``--dsp NAME=[MODEL@]HOST[:PORT][/ID]``."""

    name: str
    host: str | None = None  # None in demo mode: a simulated DSP runs in this process
    port: int = DEFAULT_DSP_PORT
    device_id: int | None = None  # the ID number set on the DSP; None = search for it
    model: str = "auto"

    def __post_init__(self) -> None:
        if not DSP_NAME.fullmatch(self.name):
            raise ValueError(
                f"DSP name {self.name!r}: 1-24 letters, digits, '.', '_' or '-' "
                "(starting with a letter or a digit)"
            )
        if not 1 <= self.port <= 65535:
            raise ValueError(f"DSP {self.name}: the port must be 1-65535")
        if self.device_id is not None and not 1 <= self.device_id <= 250:
            raise ValueError(f"DSP {self.name}: the device ID must be 1-250")
        if self.model not in MODEL_CHOICES:
            raise ValueError(f"DSP {self.name}: the model must be auto, 408, 206 or 204")

    @property
    def target(self) -> str:
        return f"{self.host}:{self.port}" if self.host else "simulated"


def parse_dsp(
    text: str,
    *,
    port: int = DEFAULT_DSP_PORT,
    device_id: int | None = None,
    model: str = "auto",
) -> DspSpec:
    """Parse ``NAME=[MODEL@]HOST[:PORT][/ID]``; the keyword arguments are the defaults.

    ``NAME`` alone (or ``NAME=MODEL@``) leaves the host out, for the demo mode."""
    name, sep, rest = text.strip().partition("=")
    if not sep:
        return DspSpec(name, None, port, device_id, model)
    if "@" in rest:
        model, _, rest = rest.partition("@")
    if "/" in rest:
        rest, _, id_text = rest.partition("/")
        device_id = _number(id_text, f"DSP {name}: the device ID")
    host = rest
    if rest.startswith("["):  # [IPv6]:port
        host, _, port_text = rest[1:].partition("]")
        if port_text:
            port = _number(port_text.removeprefix(":"), f"DSP {name}: the port")
    elif rest.count(":") == 1:  # not an IPv6 address without a port
        host, _, port_text = rest.partition(":")
        port = _number(port_text, f"DSP {name}: the port")
    return DspSpec(name, host or None, port, device_id, model or "auto")


def parse_dsps(
    items: list[str], *, port: int = DEFAULT_DSP_PORT, device_id: int | None = None,
    model: str = "auto",
) -> list[DspSpec]:  # fmt: skip
    """Parse several ``--dsp`` values; one value may hold several, separated by commas or
    spaces (the ``TDSP_DSP`` environment variable)."""
    specs = [
        parse_dsp(part, port=port, device_id=device_id, model=model)
        for item in items
        for part in re.split(r"[,\s]+", item)
        if part
    ]
    return specs


def _number(text: str, what: str) -> int:
    try:
        return int(text)
    except ValueError:
        raise ValueError(f"{what} must be a number, not {text!r}") from None


@dataclass
class ServerConfig:
    dsp_host: str | None = None
    dsp_port: int = DEFAULT_DSP_PORT
    host: str = "0.0.0.0"
    port: int = 8080
    pin: str = DEFAULT_PIN
    meter_rate_hz: float = 5.0
    lock_idle_timeout_s: float = 120.0
    resync_interval_s: float = 0.0  # 0 = off
    command_timeout_s: float | None = None
    experimental: bool = False
    demo: bool = False  # no DSP: a simulated one runs in this process
    demo_scenario: str = "demo"
    model: str = "auto"  # "auto" (detect from the identity), "408", "206" or "204"
    device_id: int | None = None  # the ID number set on the DSP; None = search for it
    tls: bool = False  # served over HTTPS: the session cookie is Secure
    # Several DSPs (--dsp NAME=HOST…); empty: the single one of dsp_host / dsp_port.
    dsps: list[DspSpec] = field(default_factory=list)

    def __post_init__(self) -> None:
        if self.dsps and self.dsp_host:
            raise ValueError("use either --dsp-host or --dsp, not both")
        if not self.dsps and not self.demo and not self.dsp_host:
            raise ValueError("--dsp-host is required (or --dsp, or --demo)")
        if not self.pin:
            raise ValueError("the access code must not be empty")
        if self.lock_idle_timeout_s <= 0:
            raise ValueError("--lock-idle-timeout must be > 0")
        if self.resync_interval_s < 0:
            raise ValueError("--resync-interval must be >= 0")
        if self.device_id is not None and not 1 <= self.device_id <= 250:
            raise ValueError("--device-id must be 1-250")
        if self.model not in MODEL_CHOICES:
            raise ValueError("--model must be auto, 408, 206 or 204")
        names = [spec.name.lower() for spec in self.dsps]
        if len(set(names)) != len(names):
            raise ValueError("every --dsp needs its own name")
        if not self.demo:
            for spec in self.dsps:
                if spec.host is None:
                    raise ValueError(f"DSP {spec.name}: the host is required (NAME=HOST)")

    @property
    def devices(self) -> list[DspSpec]:
        """The DSPs to control, in the order given."""
        if self.dsps:
            return list(self.dsps)
        return [DspSpec(SINGLE_DSP_ID, self.dsp_host, self.dsp_port, self.device_id, self.model)]

    @property
    def allow_unverified(self) -> bool:
        """Unverified parameters are allowed in demo mode or with --experimental."""
        return self.demo or self.experimental
