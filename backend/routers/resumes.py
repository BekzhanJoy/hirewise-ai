from fastapi import APIRouter, Query, Form, File, UploadFile, HTTPException
from db import list_resumes, save_resume_from_file, delete_resume

router = APIRouter()

@router.get("/resumes")
async def get_resumes(userId: str = Query(..., description="User ID")):
    try:
        resumes = list_resumes(userId)
        return {"resumes": resumes}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/resumes")
async def post_resume(userId: str = Form(...), file: UploadFile = File(...)):
    try:
        import tempfile
        from pathlib import Path
        import os
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as temp_file:
            content = await file.read()
            temp_file.write(content)
        temp_path = temp_file.name
        resume = save_resume_from_file(userId, temp_path, file.filename, file.content_type or "application/octet-stream", len(content))
        os.remove(temp_path)
        return {"resume": resume}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/resumes")
async def del_resume(userId: str = Query(...), resumeId: str = Query(...)):
    try:
        delete_resume(userId, resumeId)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

