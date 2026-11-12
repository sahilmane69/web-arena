"""Run a user task through the Playwright browser-agent loop."""

import argparse
import logging
from pathlib import Path

from dotenv import load_dotenv

from agent_loop import BrowserAgent, OpenAIPlanner
from browser_controller import BrowserController
from connected_tab_controller import ConnectedTabController


def main() -> None:
    load_dotenv(Path(__file__).with_name(".env"))
    parser = argparse.ArgumentParser(description="Run an AI browser task.")
    parser.add_argument("url", help="Starting webpage, for example https://example.com")
    parser.add_argument("task", help="What the browser agent should do")
    parser.add_argument("--max-steps", type=int, default=10, help="Maximum actions to take")
    parser.add_argument("--model", default="gpt-4o-mini", help="OpenAI model for planning")
    parser.add_argument("--headed", action="store_true", help="Show the Chromium window")
    parser.add_argument("--connected-tab", action="store_true", help="Use a Chrome extension connected tab")
    parser.add_argument("--browser-api", help="Local Express API URL for a connected tab")
    parser.add_argument("--connection-id", help="Connected Chrome tab ID")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if args.connected_tab:
        if not args.browser_api or not args.connection_id:
            parser.error("--connected-tab requires --browser-api and --connection-id")
        controller = ConnectedTabController(args.browser_api, args.connection_id)
    else:
        controller = BrowserController(headless=not args.headed)
    agent = BrowserAgent(controller, OpenAIPlanner(args.model), args.max_steps)
    try:
        result = agent.run(args.task, args.url)
        print(result.message)
    finally:
        controller.close()


if __name__ == "__main__":
    main()
