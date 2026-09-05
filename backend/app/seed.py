import math
from datetime import date

from geoalchemy2.shape import from_shape
from shapely.geometry import Polygon
from sqlalchemy import select

from app.db import SessionLocal
from app.models import MetricObservation, Project, ProjectStatus, Site, User
from app.security import hash_password

PROJECTS = [
    ("Amazon Canopy Recovery", "Brazil", -3.46, -62.22, 184_290, 88),
    ("Sundarbans Blue Carbon", "Bangladesh", 21.95, 89.18, 92_450, 81),
    ("Congo Basin Corridors", "DR Congo", -0.68, 22.05, 147_800, 76),
    ("Mau Forest Watershed", "Kenya", -0.55, 35.58, 68_900, 84),
    ("Borneo Peatland Renewal", "Indonesia", 0.95, 114.46, 110_200, 79),
    ("Sierra Meadow Resilience", "United States", 38.71, -120.1, 44_600, 73),
]


def square(lat: float, lng: float, size: float = 0.65) -> Polygon:
    return Polygon(
        [
            (lng - size, lat - size * 0.6),
            (lng + size, lat - size * 0.5),
            (lng + size * 0.8, lat + size * 0.7),
            (lng - size * 0.7, lat + size * 0.6),
            (lng - size, lat - size * 0.6),
        ]
    )


def seed() -> None:
    with SessionLocal() as db:
        if db.scalar(select(User).limit(1)):
            print("Database already contains data; seed skipped.")
            return
        admin = User(
            name="Jayant Sharma",
            email="admin@darukaa.earth",
            password_hash=hash_password("darukaa-demo"),
        )
        db.add(admin)
        db.flush()
        for index, (name, country, lat, lng, target, biodiversity) in enumerate(PROJECTS):
            project = Project(
                created_by=admin.id,
                name=name,
                country=country,
                description=(
                    "Landscape restoration monitored through carbon and habitat indicators."
                ),
                status=ProjectStatus.active,
                carbon_target=target * 1.18,
            )
            db.add(project)
            db.flush()
            for site_index in range(2):
                geometry = square(lat + site_index * 0.9, lng + site_index * 1.1)
                site = Site(
                    project_id=project.id,
                    name=f"{country} Site {site_index + 1:02}",
                    geom=from_shape(geometry, srid=4326),
                    area_ha=round(7_800 + index * 910 + site_index * 2_200, 1),
                )
                db.add(site)
                db.flush()
                for year in range(2022, 2027):
                    growth = (year - 2021) / 5
                    db.add(
                        MetricObservation(
                            site_id=site.id,
                            observed_on=date(year, 1, 1),
                            carbon_tco2e=round(target * growth / 2, 1),
                            biodiversity_index=round(
                                biodiversity - 18 + growth * 18 + math.sin(index) * 2, 1
                            ),
                            restoration_progress=round(24 + growth * (58 - index), 1),
                        )
                    )
        db.commit()
        print("Seeded 6 projects, 12 sites, and 60 observations.")


if __name__ == "__main__":
    seed()
