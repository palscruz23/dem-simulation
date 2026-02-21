# Grinding Mill DEM Web Prototype

This repository contains a starter implementation for a **discrete element modelling (DEM)** workflow tailored to grinding mills and inspired by LIGGGHTS/CFDEM.

## What is included

- FastAPI backend for mill parameter intake and run orchestration.
- Input-deck generator for a baseline LIGGGHTS model (`in.grinding_mill`).
- Runner that executes LIGGGHTS when installed (or falls back to dry-run mode).
- Browser-based UI where users set mill dimensions and simulation settings.

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload --port 8000
```

Then open `http://localhost:8000`.

## API

- `GET /api/health` returns service status.
- `POST /api/runs` accepts mill and simulation configuration and triggers a run.

Example payload:

```json
{
  "diameter_m": 5.0,
  "length_m": 7.0,
  "rpm": 15.0,
  "media_fill_fraction": 0.35,
  "particle_density": 3000,
  "media_density": 7800,
  "sim_time_s": 2.0,
  "timestep_s": 0.00001
}
```

## Connecting to a real LIGGGHTS build

Install LIGGGHTS and expose its executable. If your binary is not `lmp`, set:

```bash
export LIGGGHTS_CMD=/path/to/liggghts-binary
```

The app stores generated artifacts under `runs/<run_id>/`.

## Notes

The generated input deck is a baseline to prove web-to-solver integration. For production grinding mill fidelity, you should add:

- realistic liner geometry through `mesh/surface` and `fix move/mesh`
- calibrated breakage/contact submodels
- representative ball and ore PSD distributions
- post-processing for power draw, impact spectra, and residence distributions
