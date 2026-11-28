"""The addresses to type in a phone's browser to reach this server, printed at start.

``http://0.0.0.0:8080`` (the listen address) cannot be opened from another device: list this
machine's LAN IPv4 addresses instead. In a container, its own addresses are not the host's.
"""

from __future__ import annotations

import ipaddress
from pathlib import Path

from tracks_dsp_controller.server.tls import HostName, local_names

ANY = ("", "0.0.0.0", "::")


def in_container() -> bool:
    return Path("/.dockerenv").exists() or Path("/run/.containerenv").exists()


def _host(host: str) -> str:
    return f"[{host}]" if ":" in host else host


def open_urls(scheme: str, listen_host: str, port: int, names: list[HostName]) -> list[str]:
    """URLs reaching a server listening on ``listen_host``, given this machine's ``names``
    (``tls.local_names()``): its LAN IPv4 addresses, or localhost when it has none."""
    if listen_host not in ANY:
        return [f"{scheme}://{_host(listen_host)}:{port}"]
    lan = [
        name
        for name in names
        if isinstance(name, ipaddress.IPv4Address)
        and not name.is_loopback
        and not name.is_link_local
        and not name.is_unspecified
    ]
    hosts = [str(address) for address in sorted(set(lan))] or ["localhost"]
    return [f"{scheme}://{host}:{port}" for host in hosts]


def open_line(scheme: str, listen_host: str, port: int) -> str:
    """The start-up line saying where to open the app."""
    if in_container() and listen_host in ANY:
        return f"open {scheme}://<this host's address>:<published port> from a phone or computer"
    urls = open_urls(scheme, listen_host, port, local_names(listen_host))
    return "open from a phone or computer: " + ", ".join(urls)
