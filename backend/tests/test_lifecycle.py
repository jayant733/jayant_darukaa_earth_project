from datetime import date


def polygon(west: float = 10.0, south: float = 10.0, size: float = 0.2) -> dict:
    return {
        "type": "Polygon",
        "coordinates": [
            [
                [west, south],
                [west + size, south],
                [west + size, south + size],
                [west, south + size],
                [west, south],
            ]
        ],
    }


def create_project(client, auth, name: str = "Lifecycle Project") -> tuple[str, str]:
    response = client.post(
        "/api/projects",
        headers=auth,
        json={
            "name": name,
            "country": "Kenya",
            "carbon_target": 10_000,
            "sites": [
                {
                    "name": "Initial Site",
                    "geometry": polygon(),
                    "carbon_tco2e": 1_000,
                    "biodiversity_index": 60,
                    "restoration_progress": 30,
                }
            ],
        },
    )
    assert response.status_code == 201, response.text
    project_id = response.json()["id"]
    features = client.get("/api/sites", headers=auth).json()["features"]
    site_id = next(
        item["id"] for item in features if item["properties"]["project_id"] == project_id
    )
    return project_id, site_id


def test_public_health_and_database_readiness(client):
    assert client.get("/health").json() == {
        "status": "healthy",
        "service": "darukaa-api",
    }
    assert client.get("/ready").json() == {
        "status": "ready",
        "database": "reachable",
    }
    assert client.get("/api/ready").json()["database"] == "reachable"


def test_portfolio_analytics_are_derived_from_live_projects(client, auth):
    create_project(client, auth, "Analytics Portfolio Project")
    payload = client.get("/api/analytics/portfolio", headers=auth).json()
    assert payload["projects"]
    assert payload["totals"]["area_ha"] > 0
    assert payload["totals"]["carbon_tco2e"] >= 0


def test_project_patch_and_shared_admin_visibility(client, auth):
    project_id, _ = create_project(client, auth, "Shared Lifecycle Project")
    second = client.post(
        "/api/auth/register",
        json={
            "name": "Second Admin",
            "email": "second-lifecycle@darukaa.earth",
            "password": "second-admin-pass",
        },
    )
    assert second.status_code == 201
    second_auth = {"Authorization": f"Bearer {second.json()['access_token']}"}

    visible = client.get(f"/api/projects/{project_id}", headers=second_auth)
    assert visible.status_code == 200
    updated = client.patch(
        f"/api/projects/{project_id}",
        headers=second_auth,
        json={
            "name": "Updated Shared Project",
            "status": "active",
            "carbon_target": 20_000,
        },
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated Shared Project"
    assert updated.json()["status"] == "active"
    assert updated.json()["carbon_target"] == 20_000


def test_site_create_patch_recomputes_area_and_delete_cascades(client, auth):
    project_id, _ = create_project(client, auth, "Site Lifecycle Project")
    target_project_id, _ = create_project(client, auth, "Site Move Target Project")
    created = client.post(
        "/api/sites",
        headers=auth,
        json={
            "project_id": project_id,
            "name": "Added Site",
            "geometry": polygon(20, 20, 0.1),
            "carbon_tco2e": 250,
            "biodiversity_index": 55,
            "restoration_progress": 10,
        },
    )
    assert created.status_code == 201, created.text
    site_id = created.json()["id"]
    before = client.get(f"/api/sites/{site_id}", headers=auth).json()
    assert before["health"] >= 0

    updated = client.patch(
        f"/api/sites/{site_id}",
        headers=auth,
        json={
            "name": "Expanded Site",
            "project_id": target_project_id,
            "geometry": polygon(20, 20, 0.3),
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "Expanded Site"
    assert updated.json()["project_id"] == target_project_id
    assert updated.json()["area_ha"] > before["area_ha"]

    assert client.delete(f"/api/sites/{site_id}", headers=auth).status_code == 204
    assert client.get(f"/api/sites/{site_id}", headers=auth).status_code == 404


def test_observation_lifecycle_and_series_are_ordered(client, auth):
    _, site_id = create_project(client, auth, "Observation Lifecycle Project")
    first = client.post(
        f"/api/sites/{site_id}/observations",
        headers=auth,
        json={
            "observed_on": "2024-06-01",
            "carbon_tco2e": 500,
            "biodiversity_index": 40,
            "restoration_progress": 20,
        },
    )
    second = client.post(
        f"/api/sites/{site_id}/observations",
        headers=auth,
        json={
            "observed_on": "2023-06-01",
            "carbon_tco2e": 300,
            "biodiversity_index": 30,
            "restoration_progress": 10,
        },
    )
    assert first.status_code == second.status_code == 201

    duplicate = client.post(
        f"/api/sites/{site_id}/observations",
        headers=auth,
        json={
            "observed_on": "2024-06-01",
            "carbon_tco2e": 1,
            "biodiversity_index": 1,
            "restoration_progress": 1,
        },
    )
    assert duplicate.status_code == 409

    patched = client.patch(
        f"/api/observations/{first.json()['id']}",
        headers=auth,
        json={"observed_on": "2024-07-01", "carbon_tco2e": 700},
    )
    assert patched.status_code == 200
    assert patched.json()["carbon_tco2e"] == 700

    series = client.get(f"/api/sites/{site_id}", headers=auth).json()["series"]
    dates = [point["date"] for point in series]
    assert dates == sorted(dates)
    assert all(point["id"] for point in series)

    assert (
        client.delete(f"/api/observations/{second.json()['id']}", headers=auth).status_code == 204
    )
    detail = client.get(f"/api/sites/{site_id}", headers=auth).json()
    remaining_dates = {point["date"] for point in detail["series"]}
    assert "2023-06-01" not in remaining_dates


def test_project_delete_cascades_sites_and_observations(client, auth):
    project_id, site_id = create_project(client, auth, "Cascade Lifecycle Project")
    observation = client.post(
        f"/api/sites/{site_id}/observations",
        headers=auth,
        json={
            "observed_on": date(2022, 1, 1).isoformat(),
            "carbon_tco2e": 100,
            "biodiversity_index": 20,
            "restoration_progress": 5,
        },
    )
    assert observation.status_code == 201

    assert client.delete(f"/api/projects/{project_id}", headers=auth).status_code == 204
    assert client.get(f"/api/projects/{project_id}", headers=auth).status_code == 404
    assert client.get(f"/api/sites/{site_id}", headers=auth).status_code == 404
    assert (
        client.patch(
            f"/api/observations/{observation.json()['id']}",
            headers=auth,
            json={"carbon_tco2e": 200},
        ).status_code
        == 404
    )


def test_polygon_structure_and_wgs84_bounds_are_validated(client, auth):
    project_id, site_id = create_project(client, auth, "Geometry Validation Project")
    open_ring = {
        "type": "Polygon",
        "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1]]],
    }
    outside_wgs84 = polygon(180, 0, 1)
    assert (
        client.patch(
            f"/api/sites/{site_id}", headers=auth, json={"geometry": open_ring}
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"/api/projects/{project_id}/sites",
            headers=auth,
            json={"name": "Invalid Bounds", "geometry": outside_wgs84},
        ).status_code
        == 422
    )
