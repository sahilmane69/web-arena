"""BrowserController-compatible adapter for a user-selected Chrome extension tab."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class ConnectedTabController:
    """Send browser actions to the local Express-to-Chrome-extension bridge."""

    def __init__(self, api_url: str, connection_id: str) -> None:
        self.api_url = api_url.rstrip("/")
        self.connection_id = connection_id
        self.page: object | None = None

    def open(self) -> None:
        self.page = object()

    def close(self) -> None:
        self.page = None

    def navigate(self, url: str) -> None:
        self._command("navigate", target=url)

    def title(self) -> str:
        return self.inspect_page()["title"]

    def visible_text(self) -> str:
        return self.inspect_page()["visible_text"]

    def accessibility_tree(self) -> str:
        return self.inspect_page()["accessibility_tree"]

    def inspect_page(self) -> dict[str, Any]:
        return self._command("inspect")

    def interactive_elements(self) -> list[dict[str, str]]:
        return self.inspect_page()["interactive_elements"]

    def screenshot(self, filename: str | Path) -> None:
        self._command("screenshot", target=str(filename))

    def click(self, selector: str) -> None:
        self._command("click_selector", target=selector)

    def click_by_role(self, role: str, name: str) -> None:
        self._command("click_role", target=name, value=role)

    def click_by_text(self, text: str) -> None:
        self._command("click_text", target=text)

    def fill(self, selector: str, value: str) -> None:
        self._command("fill_selector", target=selector, value=value)

    def fill_by_label(self, label: str, value: str) -> None:
        self._command("fill_label", target=label, value=value)

    def fill_by_placeholder(self, placeholder: str, value: str) -> None:
        self._command("fill_placeholder", target=placeholder, value=value)

    def type_text(self, selector: str, text: str) -> None:
        self._command("type", target=selector, value=text)

    def search(self, query: str) -> None:
        self._command("search", value=query)

    def _command(self, command_type: str, target: str = "", value: str = "") -> dict[str, Any]:
        body = json.dumps({"type": command_type, "target": target, "value": value}).encode()
        request = Request(
            f"{self.api_url}/api/connected-tabs/{self.connection_id}/commands",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=35) as response:
                return json.loads(response.read())
        except HTTPError as error:
            raise RuntimeError(error.read().decode() or error.reason) from error
        except URLError as error:
            raise RuntimeError(f"Could not reach the browser bridge: {error.reason}") from error
