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

`agent/browser_controller.py` includes small `navigate`, `title`, `visible_text`,
`screenshot`, `click`, and `fill` helpers. The test serves its own local HTML page
and verifies each action in headless Chromium.
# web-arena
