"""Tests for the observe-plan-act loop without making AI network calls."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import unittest

from agent_loop import BrowserAgent
from browser_controller import BrowserController


TESTS_DIRECTORY = Path(__file__).parent


class FixedPlanner:
    """A deterministic planner used to test the agent loop itself."""

    def __init__(self, actions: list[dict[str, str]]) -> None:
        self.actions = actions

    def next_action(self, *_: object) -> dict[str, str]:
        return self.actions.pop(0)


class BrowserAgentTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        handler = partial(SimpleHTTPRequestHandler, directory=str(TESTS_DIRECTORY))
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}/test_page.html"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()

    def test_agent_observes_acts_and_stops_when_done(self) -> None:
        actions = [
            {"type": "fill_label", "target": "Name", "value": "Ada", "reason": "Enter name"},
            {"type": "click_role", "target": "Save", "value": "button", "reason": "Save it"},
            {"type": "done", "target": "", "value": "", "reason": "Name saved"},
        ]
        controller = BrowserController(headless=True)
        try:
            result = BrowserAgent(controller, FixedPlanner(actions), max_steps=5).run("Save Ada", self.url)
            self.assertTrue(result.completed)
            self.assertEqual(result.steps, 3)
            self.assertIn("Saved: Ada", controller.visible_text())
        finally:
            controller.close()

    def test_agent_stops_at_its_step_limit(self) -> None:
        actions = [{"type": "screenshot", "target": "tests/step.png", "value": "", "reason": "Wait"}] * 3
        controller = BrowserController(headless=True)
        try:
            result = BrowserAgent(controller, FixedPlanner(actions), max_steps=2).run("Keep trying", self.url)
            self.assertFalse(result.completed)
            self.assertEqual(result.steps, 2)
        finally:
            controller.close()
        (TESTS_DIRECTORY / "step.png").unlink(missing_ok=True)
