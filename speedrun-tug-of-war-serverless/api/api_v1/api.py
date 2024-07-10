from fastapi import APIRouter

from .endpoints import tug

router = APIRouter()
router.include_router(tug.router, prefix="/tug", tags=["Tug"])
