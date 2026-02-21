from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .models import MillConfig, RunResponse
from .runner import LiggghtsRunner

ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIR = ROOT / "frontend"
RUNS_DIR = ROOT / "runs"

app = FastAPI(title="Grinding Mill DEM Web Runner", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

runner = LiggghtsRunner(
    workspace=RUNS_DIR,
    liggghts_cmd=os.getenv("LIGGGHTS_CMD", "lmp"),
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/runs", response_model=RunResponse)
def create_run(config: MillConfig) -> RunResponse:
    artifacts = runner.run(config)
    return RunResponse(
        run_id=artifacts.run_id,
        status=artifacts.status,
        message=artifacts.message,
        output_dir=str(artifacts.output_dir),
        input_file=str(artifacts.input_file),
        log_file=str(artifacts.log_file),
        command=artifacts.command,
        charge_throw=artifacts.charge_throw,
    )


if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
