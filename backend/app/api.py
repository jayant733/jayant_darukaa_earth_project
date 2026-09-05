import json
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response, status
from geoalchemy2 import Geography
from geoalchemy2.functions import ST_AsGeoJSON, ST_GeomFromGeoJSON
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import MetricObservation, Project, Site, User
from app.schemas import (
    AuthResponse,
    HealthResponse,
    IdResponse,
    LoginRequest,
    MetricCreate,
    MetricResponse,
    MetricUpdate,
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
    ReadinessResponse,
    RegisterRequest,
    SiteAdd,
    SiteCreate,
    SiteFeatureCollection,
    SiteResponse,
    SiteUpdate,
    UserResponse,
)
from app.security import create_token, current_user, hash_password, verify_password

router = APIRouter(prefix="/api")


@router.get("/health", response_model=HealthResponse)
def api_health() -> HealthResponse:
    return HealthResponse(status="healthy", service="darukaa-api")


@router.get("/ready", response_model=ReadinessResponse)
def readiness(db: Session = Depends(get_db)) -> ReadinessResponse:
    try:
        db.execute(select(1))
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Database is not reachable") from exc
    return ReadinessResponse(status="ready", database="reachable")


@router.post("/auth/register", response_model=AuthResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> AuthResponse:
    if db.scalar(select(User).where(User.email == payload.email.lower())):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(
        name=payload.name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return AuthResponse(access_token=create_token(user.id), user=UserResponse.model_validate(user))


@router.post("/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return AuthResponse(access_token=create_token(user.id), user=UserResponse.model_validate(user))


@router.get("/auth/me", response_model=UserResponse)
def me(user: User = Depends(current_user)) -> User:
    return user


def health_score(carbon: float, biodiversity: float, progress: float, carbon_target: float) -> int:
    carbon_score = min(carbon / carbon_target * 100, 100) if carbon_target > 0 else 0
    return round(carbon_score * 0.4 + biodiversity * 0.3 + progress * 0.3)


def project_summary(project: Project) -> dict:
    latest = [site.observations[-1] for site in project.sites if site.observations]
    carbon = sum(point.carbon_tco2e for point in latest)
    biodiversity = sum(point.biodiversity_index for point in latest) / len(latest) if latest else 0
    progress = sum(point.restoration_progress for point in latest) / len(latest) if latest else 0
    return {
        "id": str(project.id),
        "name": project.name,
        "country": project.country,
        "description": project.description,
        "status": project.status.value,
        "carbon_target": project.carbon_target,
        "site_count": len(project.sites),
        "area_ha": round(sum(site.area_ha for site in project.sites), 1),
        "carbon_tco2e": round(carbon, 1),
        "biodiversity_index": round(biodiversity, 1),
        "progress": round(progress, 1),
        "health": health_score(carbon, biodiversity, progress, project.carbon_target),
    }


def project_query():
    return select(Project).options(selectinload(Project.sites).selectinload(Site.observations))


@router.get("/projects", response_model=list[ProjectResponse], response_model_exclude_none=True)
def list_projects(db: Session = Depends(get_db), _: User = Depends(current_user)) -> list[dict]:
    projects = db.scalars(project_query().order_by(Project.created_at.desc())).all()
    return [project_summary(project) for project in projects]


@router.get("/analytics/portfolio")
def portfolio_analytics(db: Session = Depends(get_db), _: User = Depends(current_user)) -> dict:
    projects = [project_summary(project) for project in db.scalars(project_query()).all()]
    count = len(projects)
    return {
        "projects": projects,
        "totals": {
            "area_ha": round(sum(item["area_ha"] for item in projects), 1),
            "carbon_tco2e": round(sum(item["carbon_tco2e"] for item in projects), 1),
            "biodiversity_index": round(
                sum(item["biodiversity_index"] for item in projects) / count, 1
            )
            if count
            else 0,
            "restoration_progress": round(sum(item["progress"] for item in projects) / count, 1)
            if count
            else 0,
        },
    }


@router.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(current_user)
) -> dict:
    project = db.scalar(project_query().where(Project.id == project_id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    result = project_summary(project)
    result["series"] = aggregate_series(project)
    return result


def aggregate_series(project: Project) -> list[dict]:
    by_date: dict[str, list[MetricObservation]] = {}
    for site in project.sites:
        for point in site.observations:
            by_date.setdefault(point.observed_on.isoformat(), []).append(point)
    return [
        {
            "date": day,
            "carbon": round(sum(p.carbon_tco2e for p in points), 1),
            "biodiversity": round(sum(p.biodiversity_index for p in points) / len(points), 1),
            "progress": round(sum(p.restoration_progress for p in points) / len(points), 1),
        }
        for day, points in sorted(by_date.items())
    ]


def polygon_expression(db: Session, geometry: object, site_name: str):
    geometry_json = json.dumps(geometry.model_dump(mode="json"))
    expression = func.ST_SetSRID(ST_GeomFromGeoJSON(geometry_json), 4326)
    valid, reason, empty, area = db.execute(
        select(
            func.ST_IsValid(expression),
            func.ST_IsValidReason(expression),
            func.ST_IsEmpty(expression),
            func.ST_Area(func.cast(expression, Geography)) / 10_000,
        )
    ).one()
    if empty or not valid or not area or area <= 0:
        detail = reason if not valid else "Polygon must enclose a non-zero area"
        raise HTTPException(
            status_code=422,
            detail=f"Site '{site_name}' boundary is invalid: {detail}",
        )
    return expression, round(float(area), 1)


def site_health(site: Site, project: Project) -> int:
    latest = site.observations[-1] if site.observations else None
    if not latest:
        return 0
    site_target = project.carbon_target / max(len(project.sites), 1)
    return health_score(
        latest.carbon_tco2e,
        latest.biodiversity_index,
        latest.restoration_progress,
        site_target,
    )


@router.get("/sites", response_model=SiteFeatureCollection)
def list_sites(db: Session = Depends(get_db), _: User = Depends(current_user)) -> dict:
    rows = db.execute(
        select(Site, ST_AsGeoJSON(Site.geom), Project.name, Project.status)
        .join(Project)
        .options(
            selectinload(Site.observations),
            selectinload(Site.project).selectinload(Project.sites),
        )
        .order_by(Site.name)
    ).all()
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": str(site.id),
                "geometry": json.loads(geometry),
                "properties": {
                    "id": str(site.id),
                    "name": site.name,
                    "project_id": str(site.project_id),
                    "project": project_name,
                    "status": project_status.value,
                    "area_ha": site.area_ha,
                    "health": site_health(site, site.project),
                },
            }
            for site, geometry, project_name, project_status in rows
        ],
    }


@router.post("/projects", response_model=IdResponse, status_code=201)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> dict:
    project = Project(
        created_by=user.id,
        name=payload.name,
        country=payload.country,
        description=payload.description,
        status=payload.status,
        carbon_target=payload.carbon_target,
    )
    db.add(project)
    db.flush()
    for item in payload.sites:
        geom_expr, area = polygon_expression(db, item.geometry, item.name)
        site = Site(
            project_id=project.id,
            name=item.name,
            geom=geom_expr,
            area_ha=area,
        )
        db.add(site)
        db.flush()
        db.add(
            MetricObservation(
                site_id=site.id,
                observed_on=date.today(),
                carbon_tco2e=item.carbon_tco2e,
                biodiversity_index=item.biodiversity_index,
                restoration_progress=item.restoration_progress,
            )
        )
    db.commit()
    return {"id": str(project.id), "message": "Project created"}


@router.get("/sites/{site_id}", response_model=SiteResponse)
def get_site(
    site_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(current_user)
) -> dict:
    row = db.execute(
        select(Site, ST_AsGeoJSON(Site.geom), Project)
        .join(Project)
        .where(Site.id == site_id)
        .options(selectinload(Site.observations))
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Site not found")
    site, geometry, project = row
    latest = site.observations[-1] if site.observations else None
    return {
        "id": str(site.id),
        "name": site.name,
        "area_ha": site.area_ha,
        "project_id": str(project.id),
        "project": project.name,
        "geometry": json.loads(geometry),
        "carbon_tco2e": latest.carbon_tco2e if latest else 0,
        "biodiversity_index": latest.biodiversity_index if latest else 0,
        "progress": latest.restoration_progress if latest else 0,
        "health": site_health(site, project),
        "series": [
            {
                "id": str(point.id),
                "date": point.observed_on.isoformat(),
                "carbon": point.carbon_tco2e,
                "biodiversity": point.biodiversity_index,
                "progress": point.restoration_progress,
            }
            for point in site.observations
        ],
    }


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(current_user),
) -> dict:
    project = db.scalar(project_query().where(Project.id == project_id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.commit()
    return {**project_summary(project), "series": aggregate_series(project)}


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(current_user),
) -> Response:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return Response(status_code=204)


def create_site_record(db: Session, project: Project, payload: SiteCreate) -> Site:
    expression, area = polygon_expression(db, payload.geometry, payload.name)
    site = Site(project_id=project.id, name=payload.name, geom=expression, area_ha=area)
    db.add(site)
    db.flush()
    db.add(
        MetricObservation(
            site_id=site.id,
            observed_on=date.today(),
            carbon_tco2e=payload.carbon_tco2e,
            biodiversity_index=payload.biodiversity_index,
            restoration_progress=payload.restoration_progress,
        )
    )
    return site


@router.post("/sites", response_model=IdResponse, status_code=201)
def create_site(
    payload: SiteAdd,
    db: Session = Depends(get_db),
    _: User = Depends(current_user),
) -> IdResponse:
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    site = create_site_record(db, project, payload)
    db.commit()
    return IdResponse(id=site.id, message="Site created")


@router.post("/projects/{project_id}/sites", response_model=IdResponse, status_code=201)
def create_project_site(
    project_id: uuid.UUID,
    payload: SiteCreate,
    db: Session = Depends(get_db),
    _: User = Depends(current_user),
) -> IdResponse:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    site = create_site_record(db, project, payload)
    db.commit()
    return IdResponse(id=site.id, message="Site created")


@router.patch("/sites/{site_id}", response_model=SiteResponse)
def update_site(
    site_id: uuid.UUID,
    payload: SiteUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(current_user),
) -> dict:
    site = db.scalar(
        select(Site)
        .where(Site.id == site_id)
        .options(selectinload(Site.observations), selectinload(Site.project))
    )
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    changes = payload.model_dump(exclude_unset=True)
    if "project_id" in changes and not db.get(Project, changes["project_id"]):
        raise HTTPException(status_code=404, detail="Project not found")
    if payload.geometry is not None:
        site.geom, site.area_ha = polygon_expression(
            db, payload.geometry, payload.name or site.name
        )
    if "name" in changes:
        site.name = changes["name"]
    if "project_id" in changes:
        site.project_id = changes["project_id"]
    db.commit()
    return get_site(site_id, db, _)


@router.delete("/sites/{site_id}", status_code=204)
def delete_site(
    site_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(current_user),
) -> Response:
    site = db.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    db.delete(site)
    db.commit()
    return Response(status_code=204)


@router.post(
    "/sites/{site_id}/observations",
    response_model=MetricResponse,
    status_code=201,
)
def create_observation(
    site_id: uuid.UUID,
    payload: MetricCreate,
    db: Session = Depends(get_db),
    _: User = Depends(current_user),
) -> MetricObservation:
    if not db.get(Site, site_id):
        raise HTTPException(status_code=404, detail="Site not found")
    if db.scalar(
        select(MetricObservation).where(
            MetricObservation.site_id == site_id,
            MetricObservation.observed_on == payload.observed_on,
        )
    ):
        raise HTTPException(status_code=409, detail="An observation already exists for this date")
    observation = MetricObservation(site_id=site_id, **payload.model_dump())
    db.add(observation)
    db.commit()
    db.refresh(observation)
    return observation


@router.patch("/observations/{observation_id}", response_model=MetricResponse)
def update_observation(
    observation_id: uuid.UUID,
    payload: MetricUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(current_user),
) -> MetricObservation:
    observation = db.get(MetricObservation, observation_id)
    if not observation:
        raise HTTPException(status_code=404, detail="Observation not found")
    changes = payload.model_dump(exclude_unset=True)
    observed_on = changes.get("observed_on")
    if observed_on is not None and db.scalar(
        select(MetricObservation).where(
            MetricObservation.site_id == observation.site_id,
            MetricObservation.observed_on == observed_on,
            MetricObservation.id != observation.id,
        )
    ):
        raise HTTPException(status_code=409, detail="An observation already exists for this date")
    for field, value in changes.items():
        setattr(observation, field, value)
    db.commit()
    db.refresh(observation)
    return observation


@router.delete("/observations/{observation_id}", status_code=204)
def delete_observation(
    observation_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(current_user),
) -> Response:
    observation = db.get(MetricObservation, observation_id)
    if not observation:
        raise HTTPException(status_code=404, detail="Observation not found")
    db.delete(observation)
    db.commit()
    return Response(status_code=204)
