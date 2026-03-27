from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import HTTPException
from fastapi.responses import JSONResponse
from routers import auth, dashboard, resumes, scans, settings, files
import os

app = FastAPI(title="Hirewise AI Local Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(dashboard.router, prefix="/api", tags=["dashboard"])
app.include_router(resumes.router, prefix="/api", tags=["resumes"])
app.include_router(scans.router, prefix="/api", tags=["scans"])
app.include_router(settings.router, prefix="/api", tags=["settings"])
app.include_router(files.router, prefix="/api", tags=["files"])

@app.get("/api/health")
async def health():
    return {"status": "ok"}

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=400,
        content={"error": str(exc)},
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, reload=True)

