import os

from fastapi.security import APIKeyHeader
from solders.keypair import Keypair

AUTHORITY_KEY = os.getenv("AUTHORITY_KEY", None)
AUTHORITY_KEYPAIR = Keypair.from_base58_string(AUTHORITY_KEY) if AUTHORITY_KEY else None

API_KEY = os.getenv("API_USER", None)
API_KEY_HEADER_AUTH = APIKeyHeader(name="X-API-KEY", auto_error=True)

RPC_URL = os.getenv("RPC_URL", "https://rpc.magicblock.app/devnet")
BASE_HOST = os.getenv("BASE_HOST", "http://localhost:8080")
BASE_HOST_TX = os.getenv("BASE_HOST_TX", "http://localhost:3000")
