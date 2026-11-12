"""Smoke test for BrowserController using a local HTML page."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import unittest

from browser_controller import BrowserController


TESTS_DIRECTORY = Path(__file__).parent


class BrowserControllerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        handler = partial(SimpleHTTPRequestHandler, directory=str(TESTS_DIRECTORY))
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        cls.server_thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}/test_page.html"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self) -> None:
        self.controller = BrowserController(headless=True)
        self.controller.open()

    def tearDown(self) -> None:
        self.controller.close()

    def test_common_browser_actions(self) -> None:
        self.controller.navigate(self.url)

        self.assertEqual(self.controller.title(), "Playwright Controller Test")
        self.assertIn("Browser controller test page", self.controller.visible_text())

        page_details = self.controller.inspect_page()
        self.assertIn("searchbox", page_details["accessibility_tree"])
        self.assertTrue(any(item["name"] == "Search" for item in page_details["interactive_elements"]))

        self.controller.fill_by_label("Name", "Ada")
        self.controller.click_by_role("button", "Save")
        self.assertIn("Saved: Ada", self.controller.visible_text())

        self.controller.search("playwright")
        self.assertIn("Searched: playwright", self.controller.visible_text())

        screenshot_path = TESTS_DIRECTORY / "controller-test.png"
        self.controller.screenshot(screenshot_path)
        self.assertTrue(screenshot_path.exists())
        screenshot_path.unlink()


if __name__ == "__main__":
    unittest.main()
