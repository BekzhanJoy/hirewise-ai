from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Dict, Any, Optional
from db import get_profile, get_settings, save_profile_and_settings, update_account

router = APIRouter()

class SettingsRequest(BaseModel):
    userId: str
    profile: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None
    account: Optional[Dict[str, Any]] = None

@router.get("/settings")
async def get_settings_endpoint(userId: str = Query(...)):
    try:
        profile = get_profile(userId)
        settings = get_settings(userId)
        return {"profile": profile, "settings": settings}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/settings")
async def put_settings(req: SettingsRequest):
    try:
        updated_user = None
        if req.account:
            _, user = update_account(req.userId, req.account)
            updated_user = user
        profile_result, settings_result = save_profile_and_settings(req.userId, req.profile or {}, req.settings or {})
        return {"profile": profile_result, "settings": settings_result, "user": updated_user}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

