import io
import os

from PIL import Image
from fastapi import APIRouter, Request
from fastapi.responses import Response, RedirectResponse
from solana.rpc.async_api import AsyncClient
from solders.pubkey import Pubkey

from api.config import RPC_URL, BASE_HOST, BASE_HOST_TX

router = APIRouter()
solana_client = AsyncClient(RPC_URL)


@router.get("/image/{identifier}/{x}", response_class=Response)
def get_blended_image(identifier: str, x: int):
    background_path = os.path.join('static', 'images', 'tug_background.jpg')
    characters_path = os.path.join('static', 'images', 'tug_characters.png')
    shark_path = os.path.join('static', 'images', 'tug_shark.png')

    background = Image.open(background_path).convert("RGBA")
    characters = Image.open(characters_path).convert("RGBA")
    shark = None

    # Add Shark if game over
    if x < -250:
        x = -280
        shark = Image.open(shark_path).convert("RGBA")
    elif x >= 250:
        x = 280
        shark = Image.open(shark_path).convert("RGBA")

    char_width = min(characters.width, background.width - x)
    char_height = characters.height

    characters = characters.crop((0, 0, char_width, char_height))
    overlay = Image.new("RGBA", background.size)
    overlay.paste(characters, (x, 0))

    if shark:
        shark_x = (background.width - shark.width) // 2
        shark_y = (background.height - shark.height) // 2
        overlay.paste(shark, (shark_x, shark_y), shark)

    blended = Image.alpha_composite(background, overlay).convert("RGB")

    buf = io.BytesIO()
    blended.save(buf, format='JPEG', quality=80)
    byte_im = buf.getvalue()

    return Response(content=byte_im, media_type="image/jpeg")


@router.options("/item/{identifier}")
async def options_item(request: Request, identifier: str):
    return RedirectResponse(url=f"https://dial.to/?action=solana-action:{BASE_HOST}/api/v1/tug/item"
                                f"/{identifier}")


@router.get("/item/{identifier}")
async def read_item(response: Response, request: Request, identifier: str):
    await add_cors_headers(response)
    account_info = await solana_client.get_account_info(Pubkey.from_string(identifier))
    if account_info.value is None:
        return {"error": "Account not found"}
    x = int.from_bytes(reversed([b for b in account_info.value.data[8:10]]), "big", signed=True)
    is_game_on = 250 > x > -250
    actions_is_game_on = [
        {
            "label": "Pull Left",
            "href": f"{BASE_HOST_TX}/pull-left?tug={identifier}"
        },
        {
            "label": "Pull Right",
            "href": f"{BASE_HOST_TX}/pull-right?tug={identifier}"
        },
        {
            "label": "Red Win",
            "href": f"{BASE_HOST_TX}/bet-left?amount={{amount}}&tug={identifier}",
            "parameters": [
                {
                    "name": "amount",
                    "label": "Enter the amount of SOL to bet",
                    "required": True,
                }
            ]
        },
        {
            "label": "White Win",
            "href": f"{BASE_HOST_TX}/bet-right?amount={{amount}}&tug={identifier}",
            "parameters": [
                {
                    "name": "amount",
                    "label": "Enter the amount of SOL to bet",
                    "required": True,
                }
            ]
        }
    ]
    actions_is_game_over = [
        {
            "label": "Claim and Close Bet",
            "href": f"{BASE_HOST_TX}/claim?tug={identifier}"
        }
    ]
    return {
        "title": "Blinking Tug of War",
        "description": f"Blinking Tug of War (tug: {x})",
        "icon": f"{BASE_HOST}/api/v1/tug/image/{identifier}/{x}",
        "label": "Tug of War",
        "links": {
            "actions": actions_is_game_on if is_game_on else actions_is_game_over
        },
    }


async def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Content-Encoding, Accept-Encoding"
