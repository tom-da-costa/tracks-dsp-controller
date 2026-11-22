import ipaddress

import pytest

from tracks_dsp_controller.server import addresses
from tracks_dsp_controller.server.tls import HostName

NAMES: list[HostName] = [
    "localhost",
    "studio-pc",
    "studio-pc.local",
    ipaddress.ip_address("127.0.0.1"),
    ipaddress.ip_address("::1"),
    ipaddress.ip_address("169.254.10.2"),
    ipaddress.ip_address("192.168.1.20"),
    ipaddress.ip_address("10.0.0.5"),
    ipaddress.ip_address("fe80::1"),
]


def test_lists_the_lan_ipv4_addresses_when_listening_on_all() -> None:
    assert addresses.open_urls("http", "0.0.0.0", 8080, NAMES) == [
        "http://10.0.0.5:8080",
        "http://192.168.1.20:8080",
    ]


def test_falls_back_to_localhost_without_a_network() -> None:
    names: list[HostName] = ["localhost", ipaddress.ip_address("127.0.0.1")]
    assert addresses.open_urls("https", "::", 8443, names) == ["https://localhost:8443"]


def test_a_given_listen_address_is_the_only_one() -> None:
    assert addresses.open_urls("http", "192.168.1.20", 80, NAMES) == ["http://192.168.1.20:80"]
    assert addresses.open_urls("http", "fd00::2", 80, NAMES) == ["http://[fd00::2]:80"]


def test_open_line_in_a_container_names_the_host(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(addresses, "in_container", lambda: True)
    assert "this host's address" in addresses.open_line("http", "0.0.0.0", 8080)


def test_open_line_lists_this_machine(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(addresses, "in_container", lambda: False)
    monkeypatch.setattr(addresses, "local_names", lambda host: NAMES)
    assert addresses.open_line("http", "0.0.0.0", 8080) == (
        "open from a phone or computer: http://10.0.0.5:8080, http://192.168.1.20:8080"
    )
