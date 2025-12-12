# RSIP Planner

A minimal yet extensible planner that combines a daily task list, RSIP tree management, and a daily journal. The MVP ships as a FastAPI backend with a Vite + React + Tailwind front-end.

## Getting started

### Backend (FastAPI)
1. Install dependencies
   ```bash
   cd backend
   python -m venv .venv && source .venv/bin/activate  # optional but recommended
   pip install -r requirements.txt
   ```
2. Run the API
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   Data is persisted to `data/storage.json` (auto-created).

### Frontend (Vite + React + Tailwind)
1. Install dependencies
   ```bash
   cd frontend
   npm install
   ```
2. Start the dev server (expects backend at http://localhost:8000)
   ```bash
   npm run dev
   ```
   Set `VITE_API_URL` to point at another backend instance if needed.

## Features
- **Daily tasks**: create, complete, soft-delete, and view tasks by date.
- **RSIP tree**: draft policies, activate (one per day rule), mark failures to rollback subtrees, and inspect recent events.
- **Journal**: capture one entry per day with quick edits and saves.
- **Today view**: summary counts, quick entry forms, and a polished dark UI.
