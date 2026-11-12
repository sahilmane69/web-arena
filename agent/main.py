"""Run a user task through the Playwright browser-agent loop."""

import argparse
import logging
from pathlib import Path

from dotenv import load_dotenv

from agent_loop import BrowserAgent, OpenAIPlanner
from browser_controller import BrowserController


def main() -> None:
    load_dotenv(Path(__file__).with_name(".env"))
    parser = argparse.ArgumentParser(description="Run an AI browser task.")
    parser.add_argument("url", help="Starting webpage, for example https://example.com")
    parser.add_argument("task", help="What the browser agent should do")
    parser.add_argument("--max-steps", type=int, default=10, help="Maximum actions to take")
    parser.add_argument("--model", default="gpt-4o-mini", help="OpenAI model for planning")
    parser.add_argument("--headed", action="store_true", help="Show the Chromium window")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    controller = BrowserController(headless=not args.headed)
    agent = BrowserAgent(controller, OpenAIPlanner(args.model), args.max_steps)
    try:
        result = agent.run(args.task, args.url)
        print(result.message)
    finally:
        controller.close()


if __name__ == "__main__":
    main()
