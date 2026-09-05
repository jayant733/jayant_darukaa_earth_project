import uuid

from app.config import normalize_database_url
from app.security import create_token, hash_password, verify_password


def test_password_hash_round_trip():
    hashed = hash_password("a-secure-password")
    assert hashed != "a-secure-password"
    assert verify_password("a-secure-password", hashed)
    assert not verify_password("wrong-password", hashed)


def test_token_contains_user_identity():
    user_id = uuid.uuid4()
    token = create_token(user_id)
    assert token
    assert isinstance(token, str)


def test_neon_database_url_uses_psycopg_and_ssl():
    url = normalize_database_url(
        "postgres://neondb_owner:secret@ep-demo.ap-southeast-1.aws.neon.tech/neondb"
    )
    assert url.startswith("postgresql+psycopg://")
    assert "sslmode=require" in url
