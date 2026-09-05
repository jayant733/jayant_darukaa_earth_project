from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api import router
from app.config import get_settings
from app.db import get_db
from app.schemas import HealthResponse, ReadinessResponse

app = FastAPI(
    title="Darukaa.Earth API",
    version="0.1.0",
    description="Carbon and biodiversity geospatial intelligence",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="healthy", service="darukaa-api")


@app.get("/ready", response_model=ReadinessResponse)
def readiness(db: Session = Depends(get_db)) -> ReadinessResponse:
    try:
        db.execute(select(1))
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Database is not reachable") from exc
    return ReadinessResponse(status="ready", database="reachable")
