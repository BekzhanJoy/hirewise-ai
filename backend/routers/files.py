from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pathlib import Path
from db import read_stored_file

from fastapi import HTTPException
router = APIRouter()

def content_type(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext == '.pdf':
        return 'application/pdf'
    elif ext == '.docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    elif ext == '.txt':
        return 'text/plain; charset=utf-8'
    else:
        return 'application/octet-stream'

@router.get("/files/{user_id}/{filename:path}")
async def get_file(user_id: str, filename: str):
    try:
        slug = [user_id, filename]
        data = read_stored_file(slug)
        return StreamingResponse(
            iter([data]),
            media_type=content_type(filename),
            headers={"Cache-Control": "no-store"}
        )
    except:
        raise HTTPException(status_code=404, detail="File not found")

