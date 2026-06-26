from __future__ import annotations

import socket
import subprocess
import sys
import time
from pathlib import Path

import pytest

playwright = pytest.importorskip("playwright.sync_api")
from playwright.sync_api import expect, sync_playwright


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _wait_for_server(base_url: str) -> None:
    import urllib.request

    last_error: Exception | None = None
    for _ in range(80):
        try:
            with urllib.request.urlopen(f"{base_url}/api/v1/context", timeout=0.5) as response:
                if response.status == 200:
                    return
        except Exception as exc:  # pragma: no cover - diagnostic path
            last_error = exc
        time.sleep(0.1)
    raise RuntimeError(f"server did not start: {last_error}")


def test_web_buttons_and_action_messages_in_real_browser(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    port = _free_port()
    base_url = f"http://127.0.0.1:{port}"
    server = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "calo.cli",
            "serve",
            "--workspace",
            str(workspace),
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
        ],
        cwd=Path(__file__).parents[1],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    try:
        _wait_for_server(base_url)
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.goto(f"{base_url}/ui/")
            page.get_by_label("Goal brief").fill("Browser acceptance async loop")
            page.get_by_label("Repo path").fill(str(workspace / "repo"))
            page.get_by_label("Loop ID").fill("browser_loop")
            page.get_by_label("Target score").fill("0.6")
            page.get_by_label("Max turns").fill("2")
            page.get_by_label("Async mode").check()
            page.get_by_role("button", name="Create loop").click()
            expect(page.get_by_text("Created browser_loop.")).to_be_visible()

            start = page.get_by_role("button", name="Start")
            step = page.get_by_role("button", name="Step")
            pause = page.get_by_role("button", name="Pause")
            collect = page.get_by_role("button", name="Await callback")
            terminate = page.get_by_role("button", name="Terminate TaskRun")
            expect(start).to_be_enabled()
            expect(step).to_be_enabled()
            expect(pause).to_be_enabled()
            expect(collect).to_be_disabled()
            expect(terminate).to_be_disabled()

            step.click()
            expect(page.get_by_text("Step succeeded: waiting callback.")).to_be_visible()
            expect(page.get_by_text("Operational pause").first).to_be_visible()
            expect(page.get_by_role("button", name="Pause", exact=True)).to_be_disabled()
            expect(page.get_by_role("button", name="Terminate TaskRun")).to_be_enabled()
            expect(page.get_by_text("Task graph", exact=True)).to_be_visible()
            expect(page.get_by_text("TaskRuns", exact=True)).to_be_visible()
            expect(page.get_by_text("Artifacts", exact=True)).to_be_visible()

            expect(page.get_by_role("button", name="Collect callback")).to_be_enabled(timeout=7000)
            page.get_by_role("button", name="Collect callback").click()
            expect(page.get_by_text("Collect callback succeeded: completed.")).to_be_visible()
            expect(page.get_by_text("Target reached")).to_be_visible()
            expect(page.get_by_text("task_graph/turn_0001.json")).to_be_visible()
            browser.close()
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
