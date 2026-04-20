from typing import List, Optional, Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from db import scan_resumes, list_job_match_history

router = APIRouter()


class ScanRequest(BaseModel):
    userId: str
    keywords: Optional[List[str]] = None
    jobDescription: Optional[str] = None
    mode: Literal['keywords', 'job_description'] = 'keywords'


@router.post('/scans')
async def post_scans(req: ScanRequest):
    try:
        if req.mode == 'job_description':
            if not (req.jobDescription or '').strip():
                raise HTTPException(status_code=400, detail='Job description is required')
            results = scan_resumes(req.userId, job_description=req.jobDescription, mode='job_description')
            return {'results': results}

        keywords = [k.strip() for k in (req.keywords or []) if k.strip()]
        if not keywords:
            raise HTTPException(status_code=400, detail='At least one keyword required')
        results = scan_resumes(req.userId, keywords=keywords, mode='keywords')
        return {'results': results}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get('/scans/history')
async def get_scans_history(userId: str = Query(..., description='User ID')):
    try:
        return {'runs': list_job_match_history(userId)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
