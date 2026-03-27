from fastapi import APIRouter, HTTPException, Query
from db import get_dashboard

router = APIRouter()

@router.get("/dashboard")
async def get_dashboard_endpoint(userId: str = Query(..., description="User ID")):
    try:
        payload = get_dashboard(userId)
        return payload
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

