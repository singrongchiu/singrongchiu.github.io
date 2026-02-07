from __future__ import annotations

import os
import pathlib
import subprocess


ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "src"


def run_cmd(args: list[str]) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        args,
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise AssertionError(
            "Command failed: {cmd}\nstdout:\n{out}\nstderr:\n{err}".format(
                cmd=" ".join(args),
                out=result.stdout,
                err=result.stderr,
            )
        )
    return result


def test_node_core_logic_suite_passes() -> None:
    run_cmd(
        [
            "node",
            "--test",
            "tests/framework_core.test.mjs",
            "tests/eightball_minigame.test.mjs",
            "tests/game_plugin_contract.test.mjs",
            "tests/minigame_factories.test.mjs",
            "tests/slingshot_minigame.test.mjs",
            "tests/maze_runner_minigame.test.mjs",
            "tests/wires_minigame.test.mjs",
            "tests/letter_filling_minigame.test.mjs",
        ]
    )


def test_compress_and_bundle_size_budget() -> None:
    run_cmd(["sh", "compress.sh"])
    artifact = ROOT / "src.tar.br"
    assert artifact.exists(), "Expected src.tar.br to be created by compress.sh"
    size_bytes = os.path.getsize(artifact)
    enforce_budget = os.getenv("ENFORCE_SIZE_BUDGET", "0") == "1"
    if enforce_budget:
        assert size_bytes < 15360, f"Expected src.tar.br < 15360 bytes, got {size_bytes}"
    else:
        assert size_bytes > 0, "Expected src.tar.br to be non-empty"


def test_runtime_sources_have_no_external_network_usage() -> None:
    blocked_tokens = ["http://", "https://", "fetch(", "XMLHttpRequest", "WebSocket("]
    for path in SRC.rglob("*"):
        if path.suffix not in {".html", ".js", ".css"}:
            continue
        text = path.read_text(encoding="utf-8")
        for token in blocked_tokens:
            assert token not in text, f"Blocked token '{token}' found in {path}"
