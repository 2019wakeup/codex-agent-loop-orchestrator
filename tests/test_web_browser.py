from __future__ import annotations

import socket
import subprocess
import sys
import time
import urllib.request
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


def _post_json(base_url: str, path: str, payload: str) -> None:
    request = urllib.request.Request(
        f"{base_url}{path}",
        data=payload.encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        assert response.status == 200


def test_web_buttons_and_action_messages_in_real_browser(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    browsed_repo = tmp_path / "browsed_repo"
    browsed_repo.mkdir()
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
            expect(page.get_by_role("button", name="English")).to_be_visible()
            expect(page.get_by_text("循环队列")).to_be_visible()
            expect(page.get_by_text("短 Codex turn 与外部长任务的本地控制台。")).to_be_visible()
            page.get_by_role("button", name="English").click()
            expect(page.get_by_role("button", name="中文")).to_be_visible()
            expect(page.get_by_text("Loop Queue")).to_be_visible()
            expect(page.get_by_text("Local control plane for short Codex turns and externally owned long work.")).to_be_visible()
            splitter = page.locator("#layout-splitter")
            expect(splitter).to_be_visible()
            repo_box = page.locator(".repo-picker-row").bounding_box()
            loop_id_box = page.locator("#goal-loop-id").bounding_box()
            assert repo_box is not None
            assert loop_id_box is not None
            assert repo_box["width"] > loop_id_box["width"] * 1.6

            splitter_box = splitter.bounding_box()
            left_box = page.locator(".loops-panel").bounding_box()
            assert splitter_box is not None
            assert left_box is not None
            start_x = splitter_box["x"] + splitter_box["width"] / 2
            start_y = splitter_box["y"] + splitter_box["height"] / 2
            page.mouse.move(start_x, start_y)
            page.mouse.down()
            page.mouse.move(2000, start_y)
            page.mouse.up()
            expanded_width = page.locator(".loops-panel").bounding_box()["width"]
            right_width = page.locator(".detail-panel").bounding_box()["width"]
            assert expanded_width <= 722
            assert right_width >= 478

            splitter_box = splitter.bounding_box()
            assert splitter_box is not None
            page.mouse.move(splitter_box["x"] + splitter_box["width"] / 2, start_y)
            page.mouse.down()
            page.mouse.move(-200, start_y)
            page.mouse.up()
            collapsed_width = page.locator(".loops-panel").bounding_box()["width"]
            assert 338 <= collapsed_width < expanded_width

            splitter.focus()
            page.keyboard.press("End")
            keyboard_width = page.locator(".loops-panel").bounding_box()["width"]
            assert keyboard_width >= expanded_width - 2

            page.get_by_role("button", name="Browse").click()
            expect(page.locator("#repo-browser-path")).to_contain_text(str(workspace))
            page.get_by_role("button", name="Up").click()
            expect(page.locator("#repo-browser-path")).to_contain_text(str(tmp_path))
            page.locator(".repo-dir", has_text=browsed_repo.name).click()
            expect(page.locator("#repo-browser-path")).to_contain_text(str(browsed_repo))
            page.get_by_role("button", name="Use folder").click()
            expect(page.get_by_text("Repository folder selected.")).to_be_visible()
            assert page.locator("#goal-repo").input_value() == str(browsed_repo)

            markdown_goal = (
                "**Browser acceptance async loop**\n\n"
                "| Signal | Expectation |\n"
                "| --- | --- |\n"
                "| Evidence | readable |\n"
                "| Operator intent | explicit |\n\n"
                "- Evidence clarity\n"
                "- Operator intent\n\n"
                "`callback_ready` must be visible"
            )
            page.get_by_label("Goal brief").fill(markdown_goal)
            expect(page.locator("#goal-objective-preview strong")).to_contain_text("Browser acceptance async loop")
            expect(page.locator("#goal-objective-preview table")).to_be_visible()
            expect(page.locator("#goal-objective-preview .markdown-table-scroll")).to_be_visible()
            expect(page.locator("#goal-objective-preview td").first).to_contain_text("Evidence")
            expect(page.locator("#goal-objective-preview li").first).to_contain_text("Evidence clarity")
            expect(page.locator("#goal-objective-preview code").first).to_contain_text("callback_ready")
            page.get_by_label("Execution backend").select_option("local")
            expect(page.get_by_label("External work mode")).to_have_value("demo")
            page.get_by_label("Loop ID").fill("browser_loop")
            page.get_by_label("Target score").fill("0.6")
            page.get_by_label("Max turns").fill("2")
            page.get_by_label("Async mode").check()
            page.get_by_role("button", name="Create loop").click()
            expect(page.get_by_text("Created browser_loop with Demo simulation and Demo fake TaskRun.")).to_be_visible()
            expect(page.get_by_text("Demo simulation backend")).to_be_visible()
            expect(page.get_by_text("This loop uses the deterministic local runner. It does not open real Codex Planner, Worker, or Judge sessions.")).not_to_be_visible()
            page.locator(".status-disclosure", has_text="Demo simulation backend").locator("summary").click()
            expect(page.get_by_text("This loop uses the deterministic local runner. It does not open real Codex Planner, Worker, or Judge sessions.")).to_be_visible()
            expect(page.get_by_text("Demo fake TaskRun mode")).to_be_visible()
            expect(page.locator(".objective-full").first.locator("strong")).to_contain_text("Browser acceptance async loop")
            expect(page.locator(".objective-full").first.locator("table")).to_be_visible()
            objective_box = page.locator(".objective-full").first.bounding_box()
            assert objective_box is not None
            assert objective_box["height"] <= 330
            expect(page.locator(".objective-full").first.locator("li").first).to_contain_text("Evidence clarity")

            page.get_by_role("tab", name="Work").click()
            page.get_by_label("Instruction").fill("Make the next turn focus on evidence clarity and operator intent.")
            page.get_by_label("Revise goal brief").fill("# Browser acceptance async loop with operator guidance\n\n- Keep evidence readable")
            page.get_by_role("button", name="Submit guidance").click()
            expect(page.get_by_text("Guidance saved and goal brief revised.")).to_be_visible()
            expect(page.locator(".objective-full")).to_contain_text("Browser acceptance async loop with operator guidance")
            expect(page.locator(".objective-full").first.locator("h3")).to_contain_text("Browser acceptance async loop with operator guidance")
            expect(page.locator(".guidance-entry").first).to_contain_text(
                "Make the next turn focus on evidence clarity and operator intent."
            )

            expect(page.get_by_text("Run", exact=True)).to_be_visible()
            expect(page.get_by_text("Wake", exact=True)).to_be_visible()
            expect(page.get_by_text("Loop control", exact=True)).to_be_visible()
            expect(page.get_by_text("TaskRun process", exact=True)).to_be_visible()
            start = page.get_by_role("button", name="Run until pause")
            step = page.get_by_role("button", name="Run one turn")
            pause = page.get_by_role("button", name="Pause loop")
            terminate = page.get_by_role("button", name="Terminate local TaskRun")
            expect(start).to_be_enabled()
            expect(step).to_be_enabled()
            expect(pause).to_be_enabled()
            expect(page.get_by_text("Callback not ready")).to_be_visible()
            expect(terminate).to_be_disabled()

            step.click()
            expect(page.get_by_text("Run one turn succeeded: waiting callback.")).to_be_visible()
            expect(page.get_by_text("Operational pause").first).to_be_visible()
            expect(page.get_by_role("button", name="Pause loop", exact=True)).to_be_disabled()
            expect(page.get_by_role("button", name="Terminate local TaskRun")).to_be_enabled()
            expect(page.get_by_text("Waiting for callback")).to_be_visible()
            expect(page.get_by_text("Task graph", exact=True)).to_be_visible()
            expect(page.get_by_text("TaskRuns", exact=True)).to_be_visible()
            page.get_by_role("tab", name="Overview").click()
            expect(page.get_by_text("Codex sessions", exact=True)).to_be_visible()
            expect(page.locator(".codex-role-card", has_text="Planner")).to_be_visible()
            expect(page.locator(".codex-role-card", has_text="Planner")).to_contain_text("Demo simulation")
            expect(page.locator(".codex-role-card", has_text="Worker")).to_be_visible()
            expect(page.locator(".codex-role-card", has_text="Judge")).to_be_visible()
            page.locator(".codex-role-card", has_text="Worker").get_by_role("button", name="Expand").click()
            expect(page.get_by_role("dialog", name="Worker turn_0001")).to_be_visible()
            expect(page.get_by_role("dialog", name="Worker turn_0001")).to_contain_text("Evidence links")
            page.get_by_role("button", name="Close").click()
            expect(page.get_by_role("dialog", name="Worker turn_0001")).not_to_be_visible()
            page.get_by_role("tab", name="Evidence").click()
            expect(page.get_by_text("Artifacts", exact=True)).to_be_visible()
            page.get_by_role("tab", name="Timeline").click()
            expect(page.get_by_text("Loop timeline", exact=True)).to_be_visible()

            expect(page.get_by_role("button", name="Collect callback")).to_be_enabled(timeout=7000)
            page.get_by_role("button", name="Collect callback").click()
            expect(page.get_by_text("Collect callback succeeded: completed.")).to_be_visible()
            expect(page.get_by_text("Target reached")).to_be_visible()
            page.get_by_role("tab", name="Evidence").click()
            expect(page.get_by_text("task_graph/turn_0001.json")).to_be_visible()
            expect(page.get_by_label("Filter by source")).to_be_visible()
            page.get_by_label("Filter by source").select_option("task_graph")
            expect(page.locator(".artifact-entry", has_text="task_graph/turn_0001.json")).to_be_visible()
            expect(page.locator(".artifact-preview-panel")).to_contain_text("task_graph/turn_0001.json")
            expect(page.locator(".artifact-preview-panel pre")).to_contain_text('"turn_id": "turn_0001"')
            expect(page.locator(".artifact-preview-panel")).to_contain_text("task graph")
            page.get_by_label("Search artifacts").fill("judge")
            expect(page.get_by_text("No artifacts match the current filters.")).to_be_visible()
            expect(page.locator(".artifact-preview-panel")).to_contain_text("Select an artifact")
            expect(page.locator(".artifact-preview-panel")).not_to_contain_text("task_graph/turn_0001.json")
            page.get_by_label("Search artifacts").fill("")
            page.get_by_label("Filter by source").select_option("all")
            page.get_by_label("Filter by kind").select_option("markdown")
            expect(page.get_by_text("turn_0001.md").first).to_be_visible()

            recover_repo = tmp_path / "browser_recover_repo"
            recover_repo.mkdir()
            (recover_repo / "write_callback.py").write_text(
                """
from __future__ import annotations

import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--callback-file", required=True)
parser.add_argument("--run-id", required=True)
parser.add_argument("--turn-id", required=True)
parser.add_argument("--loop-id", required=True)
args = parser.parse_args()
payload = {
    "loop_id": args.loop_id,
    "run_id": args.run_id,
    "turn_id": args.turn_id,
    "status": "succeeded",
    "metrics": {"score": 0.72},
    "summary": "browser command adapter callback"
}
Path(args.callback_file).write_text(json.dumps(payload), encoding="utf-8")
""".lstrip(),
                encoding="utf-8",
            )
            _post_json(
                base_url,
                "/api/v1/loops",
                f"""{{
                  "loop_id": "browser_recover_loop",
                  "objective": "Recover a loop that started without external work mode",
                  "repo_path": "{recover_repo}",
                  "target_value": 0.7,
                  "runner_kind": "local",
                  "task_adapter_mode": "none"
                }}""",
            )
            page.get_by_role("button", name="Refresh").click()
            page.get_by_role("button", name="browser_recover_loop ready").click()
            expect(page.get_by_text("No external work configured")).to_be_visible()
            expect(page.get_by_role("button", name="Run one turn")).to_be_enabled()
            page.get_by_role("button", name="Run one turn").click()
            expect(page.get_by_text("Run one turn succeeded: needs setup.")).to_be_visible()
            expect(page.get_by_text("External work mode required").first).to_be_visible()
            expect(page.get_by_role("button", name="Run until pause", exact=True)).to_be_disabled()
            expect(page.get_by_role("button", name="Run one turn", exact=True)).to_be_disabled()
            expect(page.get_by_text("Choose what happens to this accepted change")).to_be_visible()
            expect(page.get_by_label("External work type")).to_have_value("command")
            loop_controls = page.get_by_label("Loop control")
            expect(loop_controls.get_by_text("External work command wizard")).to_be_visible()
            expect(loop_controls.locator("[data-generated-command]")).to_contain_text("--callback-file {callback_file}")
            loop_controls.get_by_label("Task type").select_option("custom")
            loop_controls.locator("[data-wizard-body]").fill("python write_callback.py --run-id {run_id}")
            page.get_by_role("button", name="Configure and continue").click()
            expect(page.get_by_text("Adapter setup failed: Command adapter needs {callback_file} so the TaskRun can wake the loop.")).to_be_visible()
            loop_controls.get_by_label("Task type").select_option("python")
            page.locator("[data-wizard-script]").last.fill("write_callback.py")
            expect(loop_controls.locator("[data-generated-command]")).to_contain_text(
                "python write_callback.py --callback-file {callback_file} --run-id {run_id} --turn-id {turn_id} --loop-id {loop_id}"
            )
            page.get_by_role("button", name="Configure and continue").click()
            expect(page.get_by_text("Adapter configured; current turn continued: completed.")).to_be_visible()
            expect(page.get_by_text("Target reached")).to_be_visible()
            expect(page.get_by_text("Command TaskRun mode")).to_be_visible()
            page.get_by_role("tab", name="Work").click()
            expect(page.locator(".task-run").first).to_contain_text("succeeded")
            page.get_by_role("tab", name="Timeline").click()
            expect(page.get_by_text("Adapter quick check passed")).to_be_visible()
            browser.close()
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
