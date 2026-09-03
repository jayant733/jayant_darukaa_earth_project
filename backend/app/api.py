import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from geoalchemy2.functions import ST_AsGeoJSON, ST_GeomFromGeoJSON
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import MetricObservation, Project, Site, User
from app.schemas import AuthResponse, LoginRequest, ProjectCreate, RegisterRequest, UserResponse
from app.security import create_token, current_user, hash_password, verify_password

router = APIRouter(prefix="/api")


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


def project_summary(project: Project) -> dict:
    latest = [site.observations[-1] for site in project.sites if site.observations]
    carbon = sum(point.carbon_tco2e for point in latest)
    biodiversity = sum(point.biodiversity_index for point in latest) / len(latest) if latest else 0
    progress = sum(point.restoration_progress for point in latest) / len(latest) if latest else 0
    health = round(
        min(carbon / project.carbon_target * 100, 100) * 0.4 + biodiversity * 0.3 + progress * 0.3
    )
    return {
        "id": str(project.id),
        "name": project.name,
        "country": project.country,
        "description": project.description,
        "status": project.status.value,
        "site_count": len(project.sites),
        "area_ha": round(sum(site.area_ha for site in project.sites), 1),
        "carbon_tco2e": round(carbon, 1),
        "biodiversity_index": round(biodiversity, 1),
        "progress": round(progress, 1),
        "health": health,
    }


def project_query():
    return select(Project).options(selectinload(Project.sites).selectinload(Site.observations))


@router.get("/projects")
def list_projects(db: Session = Depends(get_db), _: User = Depends(current_user)) -> list[dict]:
    projects = db.scalars(project_query().order_by(Project.created_at.desc())).all()
    return [project_summary(project) for project in projects]


@router.get("/projects/{project_id}")
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


@router.get("/sites")
def list_sites(db: Session = Depends(get_db), _: User = Depends(current_user)) -> dict:
    rows = db.execute(
        select(Site, ST_AsGeoJSON(Site.geom), Project.name, Project.status)
        .join(Project)
        .order_by(Site.name)
    ).all()
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": str(site.id),
                "geometry": __import__("json").loads(geometry),
                "properties": {
                    "id": str(site.id),
                    "name": site.name,
                    "project_id": str(site.project_id),
                    "project": project_name,
                    "status": project_status.value,
                    "area_ha": site.area_ha,
                },
            }
            for site, geometry, project_name, project_status in rows
        ],
    }


@router.post("/projects", status_code=201)
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
        geometry = item.geometry
        if geometry.get("type") != "Polygon":
            raise HTTPException(status_code=422, detail="Sites must be GeoJSON Polygons")
        geom_expr = ST_GeomFromGeoJSON(__import__("json").dumps(geometry))
        area = db.scalar(select(func.ST_Area(func.cast(geom_expr, Geography)) / 10_000))
        db.add(Site(project_id=project.id, name=item.name, geom=geom_expr, area_ha=area))
    db.commit()
    return {"id": str(project.id), "message": "Project created"}


from geoalchemy2 import Geography  # noqa: E402
