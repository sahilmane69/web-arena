"""Small, beginner-friendly helpers for controlling Chromium with Playwright."""

from pathlib import Path

from playwright.sync_api import Browser, Page, Playwright, sync_playwright


class BrowserController:
    """Owns one Chromium browser and exposes common page actions."""

    def __init__(self, headless: bool = False) -> None:
        self.headless = headless
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None
        self.page: Page | None = None

    def open(self) -> Page:
        """Start Chromium and return a new browser tab."""
        self._playwright = sync_playwright().start()
        self._browser = self._playwright.chromium.launch(headless=self.headless)
        self.page = self._browser.new_page(viewport={"width": 1280, "height": 800})
        return self.page

    def close(self) -> None:
        """Close Chromium and release Playwright resources."""
        if self._browser is not None:
            self._browser.close()
        if self._playwright is not None:
            self._playwright.stop()

    def navigate(self, url: str) -> None:
        """Open a URL and wait until the initial page load finishes."""
        self._require_page().goto(url, wait_until="domcontentloaded")

    def title(self) -> str:
        """Return the current webpage title."""
        return self._require_page().title()

    def visible_text(self) -> str:
        """Return visible text from the page body."""
        return self._require_page().locator("body").inner_text()

    def screenshot(self, filename: str | Path) -> None:
        """Save a full-page PNG screenshot to *filename*."""
        output_path = Path(filename)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        self._require_page().screenshot(path=str(output_path), full_page=True)

    def click(self, selector: str) -> None:
        """Click the first element that matches a CSS selector."""
        self._require_page().locator(selector).click()

    def fill(self, selector: str, value: str) -> None:
        """Replace the value of an input, textarea, or contenteditable element."""
        self._require_page().locator(selector).fill(value)

    def _require_page(self) -> Page:
        if self.page is None:
            raise RuntimeError("Call open() before using browser actions.")
        return self.page
