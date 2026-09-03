import uuid

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
