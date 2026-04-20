# HireWise Ai Local

## First setup (once)

```bash
npm install --legacy-peer-deps
pip install -r backend/requirements.txt
```

## Run locally

Terminal 1 (backend):

```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Terminal 2 (frontend):

```bash
npm run dev
```

Then open:

```text
Frontend: http://localhost:3000
Backend health: http://localhost:8000/api/health
```

## Where data is stored

All local data is saved next to the site in:

```text
local-data/db.json
local-data/uploads/
```

## How to restart the project

### Quick restart

1. Stop running servers in terminals (`Ctrl + C`).
2. Start backend again:

```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

3. Start frontend again:

```bash
npm run dev
```

### Full restart (if frontend is stuck / port issues)

On Windows PowerShell:

```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
```

Then run backend + frontend again using the commands above.

## After PC reboot (Windows)

If you restarted the computer, run everything again in this order:

1. Open PowerShell in project root.
2. Start backend in Terminal 1:

```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

3. Start frontend in Terminal 2:

```bash
npm run dev
```

4. (Optional for LLM explanations) Start/check Ollama:

```bash
ollama ps
```

If no model is running, start Ollama service and ensure `deepseek-r1:1.5b` is available.

## Production mode

```bash
npm install --legacy-peer-deps
npm run build
npm run start
```
