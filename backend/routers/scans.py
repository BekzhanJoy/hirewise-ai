from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from db import scan_resumes

router = APIRouter()

class ScanRequest(BaseModel):
    userId: str
    keywords: List[str]

@router.post("/scans")
async def post_scans(req: ScanRequest):
    if not req.keywords:
        raise HTTPException(status_code=400, detail="At least one keyword required")
    try:
        results = scan_resumes(req.userId, [k.strip() for k in req.keywords if k.strip()])
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

