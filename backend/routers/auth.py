from fastapi import APIRouter, HTTPException, Form
from pydantic import BaseModel
from typing import Optional
from db import create_user, authenticate_user

router = APIRouter()

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    fullName: str

@router.post("/login")
async def login(req: LoginRequest):
    try:
        user = authenticate_user(req.email, req.password)
        return {"ok": True, "user": user}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/register")
async def register(req: RegisterRequest):
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    try:
        user = create_user(req.email, req.password, req.fullName)
        return {"ok": True, "user": user}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/logout")
async def logout():
    return {"ok": True}

