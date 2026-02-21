from __future__ import annotations

import shutil
import subprocess
import textwrap
import uuid
from dataclasses import dataclass
from pathlib import Path

from .models import MillConfig


@dataclass
class RunArtifacts:
    run_id: str
    status: str
    message: str
    output_dir: Path
    input_file: Path
    log_file: Path
    command: list[str]


class LiggghtsRunner:
    def __init__(self, workspace: Path, liggghts_cmd: str = "lmp") -> None:
        self.workspace = workspace
        self.workspace.mkdir(parents=True, exist_ok=True)
        self.liggghts_cmd = liggghts_cmd

    def run(self, config: MillConfig) -> RunArtifacts:
        run_id = uuid.uuid4().hex[:10]
        output_dir = self.workspace / run_id
        output_dir.mkdir(parents=True, exist_ok=False)

        input_file = output_dir / "in.grinding_mill"
        log_file = output_dir / "liggghts.log"
        input_file.write_text(self._build_liggghts_input(config), encoding="utf-8")

        executable = shutil.which(self.liggghts_cmd)
        if executable is None:
            message = (
                f"LIGGGHTS executable '{self.liggghts_cmd}' not found. "
                "Generated input deck only (dry-run mode)."
            )
            log_file.write_text(message + "\n", encoding="utf-8")
            return RunArtifacts(
                run_id=run_id,
                status="dry-run",
                message=message,
                output_dir=output_dir,
                input_file=input_file,
                log_file=log_file,
                command=[self.liggghts_cmd, "-in", str(input_file)],
            )

        command = [executable, "-in", str(input_file)]
        with log_file.open("w", encoding="utf-8") as stream:
            process = subprocess.run(
                command,
                cwd=output_dir,
                stdout=stream,
                stderr=subprocess.STDOUT,
                check=False,
            )

        status = "completed" if process.returncode == 0 else "failed"
        message = f"LIGGGHTS exited with code {process.returncode}."
        return RunArtifacts(
            run_id=run_id,
            status=status,
            message=message,
            output_dir=output_dir,
            input_file=input_file,
            log_file=log_file,
            command=command,
        )

    def _build_liggghts_input(self, config: MillConfig) -> str:
        radius = config.diameter_m / 2
        omega = config.rpm * 2 * 3.141592653589793 / 60
        return textwrap.dedent(
            f"""
            # Auto-generated LIGGGHTS input deck for a grinding mill
            units si
            atom_style sphere
            boundary f f f
            newton off

            region simbox block {-config.diameter_m} {config.diameter_m} {-config.diameter_m} {config.diameter_m} {-config.length_m} {config.length_m} units box
            create_box 2 simbox

            pair_style gran model hertz tangential history
            pair_coeff * *

            fix m1 all property/global youngsModulus peratomtype 1.e7 1.e7
            fix m2 all property/global poissonsRatio peratomtype 0.25 0.25
            fix m3 all property/global coefficientRestitution peratomtypepair 2 0.5 0.4 0.4 0.5
            fix m4 all property/global coefficientFriction peratomtypepair 2 0.6 0.5 0.5 0.4

            timestep {config.timestep_s}
            neighbor 0.002 bin
            neigh_modify delay 0

            # Mill shell approximation
            region mill cylinder z 0 0 {radius} {-config.length_m / 2} {config.length_m / 2} units box
            fix millwall all wall/gran model hertz tangential history primitive type 2 zcylinder {radius}

            # Rotation proxy (for realistic setups use mesh/surface + move/mesh)
            variable omega equal {omega}
            fix spin all move rotate 0 0 0 0 0 1 v_omega units box

            # Placeholder insertion (to be refined with real PSD and charge model)
            region fill cylinder z 0 0 {radius * 0.85} {-config.length_m * 0.45} {config.length_m * 0.45} units box
            fix pts1 all particletemplate/sphere 15485867 atom_type 1 density constant {config.particle_density} radius constant 0.01
            fix pdd1 all particledistribution/discrete 32452843 1 pts1 1
            fix ins all insert/pack seed 49979687 distributiontemplate pdd1 vel constant 0. 0. 0. insert_every once overlapcheck yes all_in yes particles_in_region 500 region fill

            run {int(config.sim_time_s / config.timestep_s)}
            """
        ).strip() + "\n"
