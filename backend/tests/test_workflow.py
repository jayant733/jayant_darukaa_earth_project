POLYGON = {
    "type": "Polygon",
    "coordinates": [
        [
            [-45.0, -23.0],
            [-44.5, -23.0],
            [-44.5, -22.6],
            [-45.0, -22.6],
            [-45.0, -23.0],
        ]
    ],
}


def test_health(client):
    assert client.get("/health").json()["status"] == "healthy"


def test_protected_routes_reject_anonymous_callers(client):
    assert client.get("/api/projects").status_code == 401
    assert client.get("/api/sites").status_code == 401


def test_invalid_credentials_are_rejected(client, auth):
    response = client.post(
        "/api/auth/login",
        json={"email": "workflow@darukaa.earth", "password": "not-the-password"},
    )
    assert response.status_code == 401


def test_duplicate_registration_conflicts(client, auth):
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Workflow Admin",
            "email": "workflow@darukaa.earth",
            "password": "workflow-pass",
        },
    )
    assert response.status_code == 409


def test_current_user_returns_identity(client, auth):
    body = client.get("/api/auth/me", headers=auth).json()
    assert body["email"] == "workflow@darukaa.earth"


def test_project_lifecycle_computes_geospatial_metrics(client, auth):
    created = client.post(
        "/api/projects",
        headers=auth,
        json={
            "name": "Serra do Mar Corridor",
            "country": "Brazil",
            "description": "Corridor restoration",
            "carbon_target": 40_000,
            "sites": [
                {
                    "name": "Corridor Site 01",
                    "geometry": POLYGON,
                    "carbon_tco2e": 20_000,
                    "biodiversity_index": 70,
                    "restoration_progress": 40,
                }
            ],
        },
    )
    assert created.status_code == 201
    project_id = created.json()["id"]

    detail = client.get(f"/api/projects/{project_id}", headers=auth).json()
    assert detail["site_count"] == 1
    assert detail["area_ha"] > 0
    assert detail["carbon_tco2e"] == 20_000
    assert 0 <= detail["health"] <= 100
    assert len(detail["series"]) == 1

    listing = client.get("/api/projects", headers=auth).json()
    assert any(item["id"] == project_id for item in listing)

    collection = client.get("/api/sites", headers=auth).json()
    assert collection["type"] == "FeatureCollection"
    feature = next(
        item for item in collection["features"] if item["properties"]["project_id"] == project_id
    )
    assert feature["geometry"]["type"] == "Polygon"

    site = client.get(f"/api/sites/{feature['id']}", headers=auth).json()
    assert site["project"] == "Serra do Mar Corridor"
    assert site["series"][0]["carbon"] == 20_000


def test_non_polygon_geometry_is_rejected(client, auth):
    response = client.post(
        "/api/projects",
        headers=auth,
        json={
            "name": "Invalid Geometry Project",
            "country": "Brazil",
            "sites": [{"name": "Point Site", "geometry": {"type": "Point", "coordinates": [0, 0]}}],
        },
    )
    assert response.status_code == 422


def test_self_intersecting_polygon_is_rejected(client, auth):
    bowtie = {
        "type": "Polygon",
        "coordinates": [[[0.0, 0.0], [1.0, 1.0], [1.0, 0.0], [0.0, 1.0], [0.0, 0.0]]],
    }
    response = client.post(
        "/api/projects",
        headers=auth,
        json={
            "name": "Bowtie Project",
            "country": "Brazil",
            "sites": [{"name": "Bowtie Site", "geometry": bowtie}],
        },
    )
    assert response.status_code == 422


def test_drawn_site_area_is_realistic(client, auth):
    # A boundary spanning the full draw canvas should measure tens of thousands of
    # hectares, not billions: regression guard for the global-projection bug.
    ring = [
        [35.33, -0.375],
        [35.83, -0.375],
        [35.83, -0.725],
        [35.33, -0.725],
        [35.33, -0.375],
    ]
    created = client.post(
        "/api/projects",
        headers=auth,
        json={
            "name": "Canvas Extent Project",
            "country": "Kenya",
            "sites": [
                {"name": "Canvas Site", "geometry": {"type": "Polygon", "coordinates": [ring]}}
            ],
        },
    )
    assert created.status_code == 201
    detail = client.get(f"/api/projects/{created.json()['id']}", headers=auth).json()
    assert 100_000 < detail["area_ha"] < 300_000


def test_missing_project_returns_not_found(client, auth):
    response = client.get("/api/projects/00000000-0000-0000-0000-000000000000", headers=auth)
    assert response.status_code == 404
