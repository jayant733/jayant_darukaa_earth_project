import math
import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models import ProjectStatus


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class RegisterRequest(ApiModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class LoginRequest(ApiModel):
    email: EmailStr
    password: str


class UserResponse(ApiModel):
    id: uuid.UUID
    name: str
    email: str

    model_config = ConfigDict(from_attributes=True, extra="forbid")


class AuthResponse(ApiModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class PolygonGeometry(ApiModel):
    type: Literal["Polygon"]
    coordinates: list[list[list[float]]]

    @field_validator("coordinates")
    @classmethod
    def validate_coordinates(cls, coordinates: list[list[list[float]]]) -> list[list[list[float]]]:
        if not coordinates:
            raise ValueError("Polygon must contain an exterior ring")
        for ring in coordinates:
            if len(ring) < 4:
                raise ValueError("Polygon rings must contain at least four positions")
            if ring[0] != ring[-1]:
                raise ValueError("Polygon rings must be closed")
            for position in ring:
                if len(position) != 2:
                    raise ValueError("Polygon positions must contain longitude and latitude")
                longitude, latitude = position
                if not math.isfinite(longitude) or not math.isfinite(latitude):
                    raise ValueError("Polygon coordinates must be finite")
                if not -180 <= longitude <= 180 or not -90 <= latitude <= 90:
                    raise ValueError("Polygon coordinates are outside WGS84 bounds")
        return coordinates


class SiteCreate(ApiModel):
    name: str = Field(min_length=2, max_length=180)
    geometry: PolygonGeometry
    carbon_tco2e: float = Field(default=0, ge=0)
    biodiversity_index: float = Field(default=50, ge=0, le=100)
    restoration_progress: float = Field(default=0, ge=0, le=100)


class ProjectCreate(ApiModel):
    name: str = Field(min_length=3, max_length=180)
    country: str = Field(min_length=2, max_length=120)
    description: str = ""
    status: ProjectStatus = ProjectStatus.planning
    carbon_target: float = Field(default=100_000, gt=0)
    sites: list[SiteCreate] = Field(min_length=1)


class ProjectUpdate(ApiModel):
    name: str | None = Field(default=None, min_length=3, max_length=180)
    country: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = None
    status: ProjectStatus | None = None
    carbon_target: float | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def reject_nulls(self) -> "ProjectUpdate":
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class SiteAdd(SiteCreate):
    project_id: uuid.UUID


class SiteUpdate(ApiModel):
    name: str | None = Field(default=None, min_length=2, max_length=180)
    project_id: uuid.UUID | None = None
    geometry: PolygonGeometry | None = None

    @model_validator(mode="after")
    def reject_nulls(self) -> "SiteUpdate":
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class MetricCreate(ApiModel):
    observed_on: date
    carbon_tco2e: float = Field(ge=0)
    biodiversity_index: float = Field(ge=0, le=100)
    restoration_progress: float = Field(ge=0, le=100)


class MetricUpdate(ApiModel):
    observed_on: date | None = None
    carbon_tco2e: float | None = Field(default=None, ge=0)
    biodiversity_index: float | None = Field(default=None, ge=0, le=100)
    restoration_progress: float | None = Field(default=None, ge=0, le=100)

    @model_validator(mode="after")
    def reject_nulls(self) -> "MetricUpdate":
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class IdResponse(ApiModel):
    id: uuid.UUID
    message: str


class SeriesPoint(ApiModel):
    id: uuid.UUID | None = None
    date: date
    carbon: float
    biodiversity: float
    progress: float


class ProjectResponse(ApiModel):
    id: uuid.UUID
    name: str
    country: str
    description: str
    status: ProjectStatus
    carbon_target: float
    site_count: int
    area_ha: float
    carbon_tco2e: float
    biodiversity_index: float
    progress: float
    health: int
    series: list[SeriesPoint] | None = None


class SiteResponse(ApiModel):
    id: uuid.UUID
    name: str
    area_ha: float
    project_id: uuid.UUID
    project: str
    geometry: PolygonGeometry
    carbon_tco2e: float
    biodiversity_index: float
    progress: float
    health: int
    series: list[SeriesPoint]


class FeatureProperties(ApiModel):
    id: uuid.UUID
    name: str
    project_id: uuid.UUID
    project: str
    status: ProjectStatus
    area_ha: float
    health: int


class SiteFeature(ApiModel):
    type: Literal["Feature"] = "Feature"
    id: uuid.UUID
    geometry: PolygonGeometry
    properties: FeatureProperties


class SiteFeatureCollection(ApiModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[SiteFeature]


class MetricResponse(ApiModel):
    id: uuid.UUID
    site_id: uuid.UUID
    observed_on: date
    carbon_tco2e: float
    biodiversity_index: float
    restoration_progress: float

    model_config = ConfigDict(from_attributes=True, extra="forbid")


class HealthResponse(ApiModel):
    status: Literal["healthy"]
    service: str


class ReadinessResponse(ApiModel):
    status: Literal["ready"]
    database: Literal["reachable"]
