"""Simulator de reglare a frecvenței – grup diesel-generator naval.

Pornire:  python app.py   apoi deschideți http://localhost:8000
Fiecare fereastră de browser are propria simulare (potrivit pentru laborator).
"""
import asyncio
import json
from pathlib import Path

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from sim import Simulation

ROOT = Path(__file__).parent
TICK = 0.05          # perioada de transmitere a stării către browser [s]

app = FastAPI(title="Simulator reglare frecvență DG")
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")


@app.get("/")
async def index():
    return FileResponse(ROOT / "static" / "index.html")


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    sim = Simulation()
    speed = {"k": 1.0}          # factor de timp (1 = timp real)

    async def receiver():
        while True:
            msg = json.loads(await ws.receive_text())
            if msg.get("cmd") == "speed":
                speed["k"] = max(0.0, min(4.0, float(msg.get("value", 1))))
            else:
                sim.command(msg)

    rx = asyncio.create_task(receiver())
    loop = asyncio.get_running_loop()
    last = loop.time()
    try:
        while not rx.done():
            await asyncio.sleep(TICK)
            now = loop.time()
            sim.step(min(0.2, now - last) * speed["k"])
            last = now
            await ws.send_text(json.dumps(sim.state()))
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        rx.cancel()


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
