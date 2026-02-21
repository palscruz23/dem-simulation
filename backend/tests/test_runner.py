from pathlib import Path

from app.models import MillConfig
from app.runner import LiggghtsRunner


def test_runner_creates_input_and_dry_run(tmp_path: Path) -> None:
    runner = LiggghtsRunner(tmp_path, liggghts_cmd="definitely_missing_binary")
    result = runner.run(
        MillConfig(
            diameter_m=5,
            length_m=7,
            rpm=15,
            media_fill_fraction=0.35,
            particle_density=3000,
            media_density=7800,
            sim_time_s=0.1,
            timestep_s=1e-4,
        )
    )

    assert result.status == "dry-run"
    assert result.input_file.exists()
    assert "units si" in result.input_file.read_text(encoding="utf-8")
    assert result.log_file.exists()


def test_runner_falls_back_to_common_liggghts_binary_names(
    tmp_path: Path, monkeypatch
) -> None:
    def fake_which(cmd: str) -> str | None:
        if cmd == "lmp":
            return None
        if cmd == "lmp_serial":
            return "/bin/true"
        return None

    monkeypatch.setattr("app.runner.shutil.which", fake_which)

    runner = LiggghtsRunner(tmp_path, liggghts_cmd="lmp")
    result = runner.run(
        MillConfig(
            diameter_m=5,
            length_m=7,
            rpm=15,
            media_fill_fraction=0.35,
            particle_density=3000,
            media_density=7800,
            sim_time_s=0.1,
            timestep_s=1e-4,
        )
    )

    assert result.status == "completed"
    assert result.command[0] == "/bin/true"
