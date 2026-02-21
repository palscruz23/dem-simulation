from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class MillConfig(BaseModel):
    diameter_m: float = Field(..., gt=0, description="Internal mill diameter in meters")
    length_m: float = Field(..., gt=0, description="Internal mill length in meters")
    rpm: float = Field(..., gt=0, description="Mill rotational speed in RPM")
    media_fill_fraction: float = Field(
        ..., gt=0, lt=1, description="Ball charge fill fraction (0-1)"
    )
    particle_density: float = Field(..., gt=0, description="Ore density in kg/m^3")
    media_density: float = Field(..., gt=0, description="Grinding media density in kg/m^3")
    sim_time_s: float = Field(2.0, gt=0, le=60, description="Simulation duration")
    timestep_s: float = Field(1e-5, gt=0, le=1e-2, description="DEM timestep")

    @field_validator("rpm")
    @classmethod
    def validate_rpm(cls, value: float) -> float:
        if value > 50:
            raise ValueError("RPM seems too high for an industrial grinding mill")
        return value


class RunResponse(BaseModel):
    run_id: str
    status: str
    message: str
    output_dir: str
    input_file: str
    log_file: str
    command: list[str]
