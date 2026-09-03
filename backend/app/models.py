import uuid
from datetime import UTC, date, datetime
from enum import StrEnum

from geoalchemy2 import Geometry
from sqlalchemy import Date, DateTime, Enum, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class ProjectStatus(StrEnum):
    active = "active"
    planning = "planning"
    completed = "completed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    projects: Mapped[list["Project"]] = relationship(back_populates="creator")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(180), index=True)
    country: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus), default=ProjectStatus.planning
    )
    carbon_target: Mapped[float] = mapped_column(Float, default=100_000)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    creator: Mapped[User] = relationship(back_populates="projects")
    sites: Mapped[list["Site"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class Site(Base):
    __tablename__ = "sites"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(180))
    geom: Mapped[object] = mapped_column(Geometry("POLYGON", srid=4326, spatial_index=True))
    area_ha: Mapped[float] = mapped_column(Float)
    project: Mapped[Project] = relationship(back_populates="sites")
    observations: Mapped[list["MetricObservation"]] = relationship(
        back_populates="site", cascade="all, delete-orphan"
    )


class MetricObservation(Base):
    __tablename__ = "metric_observations"
    __table_args__ = (UniqueConstraint("site_id", "observed_on"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    site_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sites.id"), index=True)
    observed_on: Mapped[date] = mapped_column(Date)
    carbon_tco2e: Mapped[float] = mapped_column(Float)
    biodiversity_index: Mapped[float] = mapped_column(Float)
    restoration_progress: Mapped[float] = mapped_column(Float)
    site: Mapped[Site] = relationship(back_populates="observations")
