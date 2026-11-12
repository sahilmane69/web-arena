"""Generic, accessibility-first browser helpers built on Playwright."""

from pathlib import Path
from typing import Any

from playwright.sync_api import Browser, Page, Playwright, sync_playwright


class BrowserController:
    """Own one Chromium tab and perform common, reusable browser actions."""

    def __init__(self, headless: bool = True) -> None:
        self.headless = headless
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None
        self.page: Page | None = None

    def __enter__(self) -> "BrowserController":
        self.open()
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

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
            self._browser = None
        if self._playwright is not None:
            self._playwright.stop()
            self._playwright = None
        self.page = None

    def navigate(self, url: str) -> None:
        """Open a user-provided URL and wait for its initial document to load."""
        self._require_page().goto(url, wait_until="domcontentloaded")

    def title(self) -> str:
        """Return the current webpage title."""
        return self._require_page().title()

    def visible_text(self) -> str:
        """Return the rendered text from the page body."""
        return self._require_page().locator("body").inner_text()

    def accessibility_tree(self) -> str:
        """Return Playwright's ARIA snapshot of the page's accessible content."""
        return self._require_page().locator("body").aria_snapshot()

    def inspect_page(self) -> dict[str, Any]:
        """Collect simple content and accessibility details for the current page."""
        page = self._require_page()
        return {
            "url": page.url,
            "title": self.title(),
            "visible_text": self.visible_text(),
            "accessibility_tree": self.accessibility_tree(),
            "interactive_elements": self.interactive_elements(),
        }

    def interactive_elements(self) -> list[dict[str, str]]:
        """List visible controls with useful DOM and accessibility metadata."""
        selector = ", ".join([
            "a[href]", "button", "input:not([type='hidden'])", "textarea", "select",
            "[contenteditable='true']", "[role='button']", "[role='link']",
            "[role='textbox']", "[role='searchbox']", "[role='checkbox']",
            "[role='radio']", "[role='combobox']", "[tabindex]:not([tabindex='-1'])",
        ])
        return self._require_page().locator(selector).evaluate_all(
            """elements => elements.filter(element => {
                const style = window.getComputedStyle(element);
                return style.display !== 'none' && style.visibility !== 'hidden'
                    && element.getClientRects().length > 0;
            }).map(element => {
                const labelledBy = (element.getAttribute('aria-labelledby') || '')
                    .split(/\\s+/).filter(Boolean)
                    .map(id => document.getElementById(id)?.innerText || '').join(' ');
                const label = element.labels ? Array.from(element.labels)
                    .map(item => item.innerText).join(' ') : '';
                const inputType = element.getAttribute('type') || '';
                const implicitRole = element.tagName === 'BUTTON' ? 'button'
                    : element.tagName === 'A' ? 'link'
                    : inputType === 'search' ? 'searchbox'
                    : ['checkbox', 'radio'].includes(inputType) ? inputType
                    : ['INPUT', 'TEXTAREA'].includes(element.tagName) ? 'textbox' : '';
                return {
                    tag: element.tagName.toLowerCase(),
                    role: element.getAttribute('role') || implicitRole,
                    name: (element.getAttribute('aria-label') || labelledBy || label
                        || element.innerText || element.getAttribute('value')
                        || element.getAttribute('placeholder') || element.getAttribute('title') || '').trim(),
                    type: inputType,
                    placeholder: element.getAttribute('placeholder') || '',
                    href: element.getAttribute('href') || ''
                };
            })"""
        )

    def screenshot(self, filename: str | Path) -> None:
        """Save a full-page PNG screenshot to *filename*."""
        output_path = Path(filename)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        self._require_page().screenshot(path=str(output_path), full_page=True)

    def click(self, selector: str) -> None:
        """Click a CSS selector when semantic information is unavailable."""
        self._require_page().locator(selector).click()

    def click_by_role(self, role: str, name: str) -> None:
        """Click a control by its accessible role and name (preferred)."""
        self._require_page().get_by_role(role, name=name, exact=True).click()

    def click_by_text(self, text: str) -> None:
        """Click visible text when an accessible role is not known."""
        self._require_page().get_by_text(text, exact=True).click()

    def fill(self, selector: str, value: str) -> None:
        """Replace the value of an element selected with CSS."""
        self._require_page().locator(selector).fill(value)

    def fill_by_label(self, label: str, value: str) -> None:
        """Fill a form field by its visible or ARIA label (preferred)."""
        self._require_page().get_by_label(label, exact=True).fill(value)

    def fill_by_placeholder(self, placeholder: str, value: str) -> None:
        """Fill a field by its placeholder when it has no label."""
        self._require_page().get_by_placeholder(placeholder, exact=True).fill(value)

    def type_text(self, selector: str, text: str) -> None:
        """Type text character by character into a CSS-selected field."""
        self._require_page().locator(selector).press_sequentially(text)

    def search(self, query: str) -> None:
        """Search using a semantic searchbox, then submit it with Enter."""
        page = self._require_page()
        search_box = page.get_by_role("searchbox")
        if search_box.count() == 0:
            search_box = page.locator("input[type='search']")
        search_box.first.fill(query)
        search_box.first.press("Enter")

    def _require_page(self) -> Page:
        if self.page is None:
            raise RuntimeError("Call open() before using browser actions.")
        return self.page
