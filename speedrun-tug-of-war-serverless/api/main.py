"""Main file of the Speedrun Blinks Tug-Of-War API."""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from mangum import Mangum
from starlette.staticfiles import StaticFiles

from api import __version__
from api.api_v1.api import router as api_router

stage = os.environ.get("STAGE", "")
root_path = f"/{stage}/" if stage else ""

app = FastAPI(title="Tug Of War API", version=__version__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the static directory to serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", include_in_schema=False)
async def docs_redirect():
    return RedirectResponse(url="/docs")


@app.get("/version")
def version():
    """GET / endpoint."""
    return {"message": f"API version: {__version__}"}


@app.get("/actions.json")
def get_actions():
    return {
        "rules": [
            {
                "pathPattern": "/*",
                "apiPath": "/*"
            },
            {
                "pathPattern": "/api/**",
                "apiPath": "/api/**"
            }
        ]
    }


app.include_router(api_router, prefix="/api/v1")

handler = Mangum(app)
