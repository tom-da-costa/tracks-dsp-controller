"""Shared-code login, in-memory sessions and a login rate limit (docs/ARCHITECTURE.md §8).

Two codes: the access code opens a full session; the optional view code (``--view-pin``) a
read-only one, which sees everything and changes nothing (the WebSocket hub enforces it).
"""

from __future__ import annotations

import hmac
import secrets
import time
from collections.abc import Callable
from dataclasses import dataclass, field

SESSION_COOKIE = "dsp408_session"
MAX_FAILURES = 5
COOLDOWN_S = 30.0
NAME_MAX = 32


class LoginError(Exception):
    """Wrong code."""


class RateLimitedError(Exception):
    """Too many failures from this address."""

    def __init__(self, retry_after: float) -> None:
        super().__init__(f"too many attempts, retry in {retry_after:.0f} s")
        self.retry_after = retry_after


@dataclass(slots=True)
class ClientSession:
    token: str
    client_id: str
    name: str
    created: float
    # Screen lock: the browser's UI is locked until the access code is typed again. Kept here,
    # not in the browser, so that a reload does not unlock it; every tab of the session follows.
    screen_locked: bool = False
    # Opened with the view code: sees everything, changes nothing.
    read_only: bool = False


@dataclass(slots=True)
class _Attempts:
    failures: int = 0
    blocked_until: float = 0.0


def clean_name(name: str | None, fallback: str) -> str:
    """Printable, trimmed display name."""
    text = "".join(ch for ch in (name or "") if ch.isprintable()).strip()[:NAME_MAX]
    return text or fallback


@dataclass
class AuthManager:
    pin: str
    view_pin: str | None = None
    clock: Callable[[], float] = time.monotonic
    _sessions: dict[str, ClientSession] = field(default_factory=dict)
    _attempts: dict[str, _Attempts] = field(default_factory=dict)
    _counter: int = 0

    def check_pin(self, pin: str, address: str) -> bool:
        """Check a code, with the per-address rate limit (login, screen unlock).

        Returns True for the view code (a read-only session), False for the access code."""
        now = self.clock()
        attempts = self._attempts.setdefault(address, _Attempts())
        if attempts.blocked_until > now:
            raise RateLimitedError(attempts.blocked_until - now)
        full = hmac.compare_digest(pin.encode(), self.pin.encode())
        view = self.view_pin is not None and hmac.compare_digest(
            pin.encode(), self.view_pin.encode()
        )
        if not (full or view):
            attempts.failures += 1
            if attempts.failures >= MAX_FAILURES:
                attempts.failures = 0
                attempts.blocked_until = now + COOLDOWN_S
            raise LoginError("wrong code")
        self._attempts.pop(address, None)
        return not full

    def login(self, pin: str, name: str | None, address: str) -> ClientSession:
        read_only = self.check_pin(pin, address)
        return self.open_session(name, read_only=read_only)

    def open_session(self, name: str | None, *, read_only: bool = False) -> ClientSession:
        """A new session, once the code is checked."""
        now = self.clock()
        self._counter += 1
        client_id = f"c{self._counter}-{secrets.token_hex(3)}"
        session = ClientSession(
            token=secrets.token_urlsafe(32),
            client_id=client_id,
            name=clean_name(name, f"Client {self._counter}"),
            created=now,
            read_only=read_only,
        )
        self._sessions[session.token] = session
        return session

    def get(self, token: str | None) -> ClientSession | None:
        return self._sessions.get(token) if token else None

    def logout(self, token: str | None) -> ClientSession | None:
        return self._sessions.pop(token, None) if token else None

    def logout_client(self, client_id: str) -> ClientSession | None:
        """End the session of ``client_id`` (disconnected by the master)."""
        for token, session in list(self._sessions.items()):
            if session.client_id == client_id:
                return self._sessions.pop(token)
        return None
