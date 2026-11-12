"""A minimal browser-controller example."""

from browser_controller import BrowserController


def main() -> None:
    controller = BrowserController(headless=False)
    try:
        controller.open()
        controller.navigate("https://example.com")
        print(f"Title: {controller.title()}")
        print(f"Visible text: {controller.visible_text()}")
        controller.screenshot("screenshots/example.png")
    finally:
        controller.close()


if __name__ == "__main__":
    main()
