import uuid
from datetime import date

from pydantic import BaseModel, EmailStr, Field

from app.models import ProjectStatus


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: str

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class SiteCreate(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    geometry: dict
    carbon_tco2e: float = Field(default=0, ge=0)
    biodiversity_index: float = Field(default=50, ge=0, le=100)
    restoration_progress: float = Field(default=0, ge=0, le=100)


class ProjectCreate(BaseModel):
    name: str = Field(min_length=3, max_length=180)
    country: str = Field(min_length=2, max_length=120)
    description: str = ""
    status: ProjectStatus = ProjectStatus.planning
    carbon_target: float = Field(default=100_000, gt=0)
    sites: list[SiteCreate] = Field(min_length=1)


class MetricPoint(BaseModel):
    observed_on: date
    carbon_tco2e: float
    biodiversity_index: float
    restoration_progress: float
