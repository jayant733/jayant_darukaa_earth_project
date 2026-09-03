import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://darukaa:darukaa@localhost:15432/darukaa_test",
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from app.db import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402

engine = create_engine(TEST_DATABASE_URL)
TestSession = sessionmaker(bind=engine, expire_on_commit=False)


@pytest.fixture(scope="session", autouse=True)
def schema():
    with engine.begin() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def client():
    def override():
        with TestSession() as session:
            yield session

    app.dependency_overrides[get_db] = override
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth(client):
    email = "workflow@darukaa.earth"
    response = client.post(
        "/api/auth/register",
        json={"name": "Workflow Admin", "email": email, "password": "workflow-pass"},
    )
    if response.status_code == 409:
        response = client.post(
            "/api/auth/login", json={"email": email, "password": "workflow-pass"}
        )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
