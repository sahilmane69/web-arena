# WebArena Agent

A minimal WebArena-inspired starter project with a React frontend, Express API, and Python browser-agent entry point.

## Run locally

Install dependencies:

```bash
npm install --prefix frontend
npm install --prefix backend
```

Start each service in its own terminal:

```bash
npm run dev:frontend
npm run dev:backend
```

The frontend is served at `http://localhost:5173` and the API at `http://localhost:3001`.

## Project structure

- `frontend/` — React + Vite client
- `backend/` — Express API
- `agent/` — Python Playwright browser controller

## Browser controller

Install the Python dependency and Chromium once:

```bash
python3 -m venv agent/.venv
agent/.venv/bin/pip install -r agent/requirements.txt
agent/.venv/bin/playwright install chromium
```

Run the local smoke test:

```bash
cd agent
.venv/bin/python -m unittest tests/test_controller.py
```

`agent/browser_controller.py` is a generic, accessibility-first browser agent. It
uses Playwright's built-in role, label, placeholder, and text locators instead of
website-specific selectors. It can inspect page text, ARIA content, and visible
interactive elements, then navigate, click, type, fill, search, and take screenshots.

Inspect any URL in headless Chromium:

```bash
cd agent
.venv/bin/python main.py https://example.com --screenshot screenshots/example.png
```

For interactions, prefer `click_by_role("button", "Save")` and
`fill_by_label("Email", "me@example.com")`. Generic CSS-based `click` and `fill`
remain available as a fallback when a website lacks accessible semantics. The local
test page exercises standard HTML roles and labels without targeting a particular
website.

## AI execution loop

The agent loop in `agent/agent_loop.py` repeats: inspect the current page, ask the
AI for one JSON action, execute it, then inspect the updated page. It has a default
10-step limit, logs every planned action and error, and stops when the AI returns
`done`.

Add your key to `agent/.env` (the file is ignored by Git), then run a task:

```bash
cd agent
.venv/bin/pip install -r requirements.txt
.venv/bin/python main.py https://example.com "Find the page heading" --max-steps 5
```

`agent/.env.example` is a safe template to copy if you need to recreate the file.

The supported actions are `click_role`, `click_text`, `fill_label`,
`fill_placeholder`, `type`, `search`, `navigate`, `screenshot`, and `done`.
The AI receives page text, the ARIA snapshot, and visible interactive elements each
step; page content is treated as untrusted data rather than instructions.

## Web interface

Start the backend and frontend in separate terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

Open `http://localhost:5173`, enter a URL and task, and start the agent. The
frontend sends `POST /api/tasks` to Express, then polls `GET /api/tasks/:id` for
the status and execution logs. Tasks are held in memory, so restarting the backend
clears previous task history.

## Use your signed-in Chrome tab

The included `extension/` folder is a local Chrome extension that lets you opt in
to using one of your existing browser tabs. It does not copy cookies or control
unselected tabs.

1. Start the Express backend.
2. In Chrome, visit `chrome://extensions`, turn on **Developer mode**, choose
   **Load unpacked**, and select this project's `extension/` folder.
3. Open and sign in to the website you want to use, then click the WebArena
   Connector extension icon and choose **Connect this tab**.
4. In the React app, click **Refresh connected tabs**, select the connected tab,
   then start the task.

The extension will show Chrome's debugger-access warning because it needs the
ability to inspect and interact with the tab you explicitly selected. Keep the
backend running while it is connected.
# web-arena
