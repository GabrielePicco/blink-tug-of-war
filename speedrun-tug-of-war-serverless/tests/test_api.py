"""Unit tests of FasAPI-based API"""
from fastapi.testclient import TestClient

from api import __version__
from api.main import app

client = TestClient(app)


def test_version():
    """Testing API version."""
    response = client.get("/version")
    assert response.status_code == 200
    assert __version__ in response.json()["message"]
