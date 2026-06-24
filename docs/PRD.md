# 产品需求文档：Codex Agent Loop Orchestrator

版本：v2 草案
日期：2026-06-24

## 1. 背景与定位

Codex Agent Loop Orchestrator 是一个独立后台服务进程，用来调度基于 Codex SDK 的本地 Codex 代理线程，让长程异步任务形成低噪声、可恢复、可审计的自我改进循环。

它不是把 Codex 变成一个持续在线、持续消耗 token 的守护进程，而是在每一轮需要模型推理、任务分配、代码改进、验收判断或复盘时才启动短生命周期 Codex turn。训练、评估、下载、压测等耗时任务由外部进程或调度器持有；Orchestrator 负责保存状态、检查契约、调用 Codex 获得智能判断，并执行最终状态迁移。

核心价值：

- 避免用长时间 Bash 等待把 Codex turn 卡住，减少无效 token 消耗。
- 将“长任务执行”和“模型推理决策”拆开，让 Codex 专注于任务分配、代码改进、验收判断和复盘。
- 用 Git、结构化状态文件、Markdown handoff 和 metrics 快照完成跨轮接力。
- 让停止条件、健康判定、节奏控制、失败升级都由外部壳服务明确执行；Codex 可以提出建议，但不能绕过壳的硬规则。

## 2. 目标用户

- 机器学习研究者：长时间模型训练、消融实验、指标驱动的训练代码迭代。
- 工程优化开发者：性能优化、CI 修复、复杂回归修复、benchmark 驱动改进。
- 自动化平台维护者：希望把 Codex 嵌入内部研发流水线、实验平台或调度系统。

## 3. 设计原则

1. Orchestrator 是循环所有者，Codex 是模型能力提供者。
2. Codex 可承担 Planner、Worker、Judge 三类短生命周期角色，但不拥有 loop 生命周期。
3. Codex 不负责持续等待训练完成，不直接执行最终状态迁移。
4. 每轮 Codex 输出必须落盘：计划、代码变更、验收意见、handoff Markdown、结构化 turn summary。
5. 原始日志留在磁盘或对象存储，注入 Codex 的上下文只包含短摘要、关键指标和必要路径。
6. 健康判定使用多信号，不用单一 GPU 利用率、单一日志行或单一 metric 做破坏性决策。
7. 默认流程是 operational pause：长任务被外部进程接管后，Codex turn 结束，直到 webhook、watchdog 或人工事件唤醒。
8. 所有自动修改必须可追踪、可回滚、可复现。

## 4. 非目标

- 不实现一个假装 Codex 自己永远在线的“原生自循环内核”。
- 不让 Codex 在单个 turn 内长时间轮询训练日志。
- 不由 Codex 自行执行删除数据、重跑大型实验、清理任务图、强制覆盖用户代码等高风险动作。
- MVP 不做多租户 SaaS、分布式队列集群、复杂 UI、云端资源编排。
- MVP 不要求自动 merge 或自动部署；自动 PR/merge 可作为后续扩展。

## 5. 关键用户故事

### 5.1 指标驱动训练改进

用户定义目标：提升验证集 F1 到 0.82，最多 8 轮，每轮必须保留代码 diff、训练配置、metrics 和改进思路。

流程：

1. 用户创建 loop，提交目标、仓库路径、训练命令、评估结果 schema、停止条件。
2. Orchestrator 创建 loop contract，启动 Codex Planner 生成首轮任务计划。
3. Orchestrator 将计划交给 Codex Worker，Worker 阅读目标、历史结果、当前代码，完成一次代码或配置改进。
4. Orchestrator 运行验证命令，再调用 Codex Judge 评估 diff、测试结果和风险。
5. Orchestrator 根据 Judge 建议、硬规则和 human_gate 决定提交 Git commit 或进入人工审阅。
6. Orchestrator 启动训练任务后立即结束 Codex turn。
7. 训练脚本完成后 POST webhook，包含 run_id、状态、metrics、日志路径、artifact 路径。
8. Orchestrator 构造 evidence packet，必要时调用 Codex Judge 做指标验收和下一步建议。
9. Orchestrator 根据 Judge 建议和策略判断：
   - 已达成目标：进入 completed_verify。
   - 失败但可诊断：进入 failed_needs_action。
   - 未达标但仍有迭代预算：启动下一轮 Codex。
   - 无明显提升且触发 patience：停止 loop 并生成总结。

### 5.2 长任务健康监控但低噪

训练可能运行 6 小时。Orchestrator 不把日志持续塞给 Codex，而是：

- 接收进度心跳或检查状态文件。
- 只在状态转移、失败、卡死、完成时唤醒 Codex。
- 对 healthy_wait 只更新本地 state，不发送冗长报告。

### 5.3 人工审阅模式

用户设置 human_gate：

- 每轮 Codex 改完代码后先停在 review_required。
- 用户确认 diff 后 Orchestrator 才提交并启动训练。
- 对破坏性操作、依赖大改、数据重建、重跑大实验都必须人工确认。

### 5.4 模型辅助任务分配与验收

用户希望 Orchestrator 不只是按固定规则迭代，而是借助 Codex 判断“下一步该做什么”和“本轮是否可接受”。

流程：

1. Orchestrator 收到训练结果，提取 metrics、diff summary、测试结果、日志摘要和历史趋势。
2. Codex Judge 判断本轮变化是否可信、是否有回归、是否需要回滚或修复。
3. Codex Planner 基于 Judge 结论生成下一轮任务分配。
4. Orchestrator 校验 Planner/Judge 输出是否符合 contract、预算、权限和停止条件。
5. Orchestrator 只执行通过策略校验的动作。

## 6. 系统架构

### 6.1 组件

1. API Server
   - 建议 FastAPI。
   - 提供 loop 创建、启动、停止、状态查询、webhook 接收接口。

2. Loop Controller
   - 维护 loop 状态机。
   - 解析停止条件、节奏策略、失败策略。
   - 决定是否启动 Codex Planner、Worker、Judge turn，是否启动训练任务或人工确认。
   - 对 Codex 输出做策略校验，并执行最终状态迁移。

3. Codex Runner
   - 基于 Codex SDK 启动、继续或恢复 Codex thread。
   - 支持 `planner`、`worker`、`judge` 三种 role profile。
   - 注入 prompt、contract、历史 handoff、metrics summary、git diff 摘要和 evidence packet。
   - 读取 Codex final_response、结构化 JSON 输出和要求落盘的产物。
   - 校验 Codex 是否写入计划、handoff、judge report 等必需 artifact。

4. Policy Engine
   - 执行硬停止条件：max_turns、patience、min_delta、预算、用户暂停、失败阈值。
   - 检查 Codex 建议是否违反权限边界、human_gate 或 contract。
   - 将 Codex 的模型判断转换为可执行 decision，或转入 review_required。

5. Task Runner
   - 启动训练、benchmark、测试、评估脚本。
   - 推荐 tmux、systemd、Slurm、Ray、Kubernetes Job 或本地 subprocess 后台化。
   - 不阻塞 API Server 主事件循环。

6. Webhook Receiver
   - 接收训练脚本或任务系统回调。
   - 做签名校验、幂等处理、schema 校验。

7. State Store
   - MVP 可用 SQLite + 文件系统。
   - 记录 loop、turn、run、event、artifact、decision、policy_result。

8. Artifact Store
   - MVP 使用仓库内 `.codex/agent-loop/<loop_id>/`。
   - 保存 contract、plan、handoff、judge report、metrics、日志摘要、Codex 输出、run manifest。

9. Git Adapter
   - 检查 dirty tree。
   - 生成 diff summary。
   - 创建 branch、commit、tag。
   - 支持 rollback 到指定 turn commit。

### 6.2 推荐技术选型

MVP 主路径：

- Python 3.10+
- FastAPI + Uvicorn
- `openai-codex` Python SDK
- SQLite
- Git CLI
- Pydantic schema
- tmux 或 subprocess 作为本地任务持有者

兼容路径：

- 若 Python SDK beta 风险影响稳定性，可引入 Node.js worker，使用 `@openai/codex-sdk` 作为 Codex Runner sidecar。
- 若需要更深的事件流、审批、会话历史集成，可后续研究 Codex app-server 协议，但自动化 job/CI 场景优先使用 Codex SDK。

## 7. 状态机

### 7.1 Loop 状态

- created：loop 已创建，contract 已写入。
- ready：环境检查通过，可启动首轮。
- planning：Codex Planner 正在生成或修订下一轮任务计划。
- codex_running：Codex Worker 正在进行代码改进。
- judging：Codex Judge 正在评估 diff、测试、metrics 或失败证据。
- policy_checking：Orchestrator 正在把 Codex 建议与硬规则、权限和停止条件对齐。
- review_required：等待用户审阅 Codex diff 或危险动作。
- validation_running：运行轻量测试、lint、smoke check。
- training_running：长任务已启动，由外部 owner 持有。
- waiting_callback：等待 webhook、状态文件或 watchdog。
- evaluating_result：Orchestrator 正在解析结果并决策。
- completed：达到停止条件并完成验证。
- failed：不可自动恢复的失败。
- paused：用户或策略暂停，保留 resume contract。
- cancelled：用户取消。

### 7.2 决策枚举

沿用低噪 loop contract 中的决策语言：

- continue_now：setup、验证或立即诊断仍有价值。
- operational_pause：长任务已由外部 owner 持有，下一次有用检查在未来。
- healthy_wait：唤醒后确认健康，记录状态并继续等待。
- completed_verify：目标产物出现或指标达标，需要最终验证。
- failed_needs_action：有失败证据，需要最小诊断和恢复策略。
- blocked_needs_user：需要凭据、数据、人工选择或危险动作确认。

### 7.3 Codex Turn 类型

1. Planner Turn
   - 目的：把目标、历史结果和 Judge 反馈转成下一轮具体任务。
   - 输入：contract、metrics trend、recent handoff、judge report、repo summary。
   - 输出：`plan/turn_<n>.json` 和 `plan/turn_<n>.md`。
   - 不允许：直接修改代码、启动训练、决定最终停止。

2. Worker Turn
   - 目的：执行 Planner 分配的代码、配置、测试或文档改进。
   - 输入：plan、contract、相关文件路径、必要历史。
   - 输出：代码变更、测试变更、`handoff/turn_<n>.md`、结构化 worker summary。
   - 不允许：长时间等待训练、执行高风险破坏动作。

3. Judge Turn
   - 目的：验收 Worker diff、验证结果、训练 metrics、失败证据和回归风险。
   - 输入：evidence packet、diff summary、validation result、metrics summary、log tail。
   - 输出：`judge/turn_<n>.json` 和 `judge/turn_<n>.md`。
   - 不允许：直接提交代码、绕过 Policy Engine、启动下一轮。

Codex 的 Planner/Judge 输出属于模型建议；Orchestrator 必须通过 Policy Engine 校验后才执行状态迁移。

## 8. Loop Contract

每个 loop 必须有一个持久 contract，路径：

`<repo>/.codex/agent-loop/<loop_id>/contract.json`

建议 schema：

```json
{
  "loop_id": "loop_20260624_001",
  "objective": "提升验证集 F1 到 0.82",
  "repo_path": "/abs/path/to/repo",
  "branch": "agent-loop/f1-improvement",
  "success_criteria": [
    "val_f1 >= 0.82",
    "smoke tests pass",
    "no regression in latency > 10%"
  ],
  "iteration_limits": {
    "max_turns": 8,
    "patience": 3,
    "min_delta": 0.002
  },
  "commands": {
    "pre_codex_check": "git status --short",
    "validation": "pytest tests/smoke -q",
    "train": "python train.py --config configs/current.yaml --callback-url ${CALLBACK_URL}"
  },
  "codex_roles": {
    "planner": {
      "enabled": true,
      "writes": ["plan_json", "plan_markdown"]
    },
    "worker": {
      "enabled": true,
      "writes": ["code_diff", "handoff_markdown", "worker_summary"]
    },
    "judge": {
      "enabled": true,
      "writes": ["judge_json", "judge_markdown"]
    }
  },
  "policy": {
    "codex_can_recommend_stop": true,
    "codex_can_recommend_rollback": true,
    "orchestrator_executes_state_transitions": true,
    "require_policy_check_after_judge": true
  },
  "state_paths": [
    ".codex/agent-loop/loop_20260624_001/state.json",
    "runs/latest/metrics.json",
    "runs/latest/train.log"
  ],
  "health_checks": [
    "process exists or scheduler state is running",
    "metrics/checkpoint/log mtime changes across expected interval",
    "no fatal string appears in recent log tail",
    "disk space remains above configured threshold"
  ],
  "cadence": {
    "startup_minutes": 5,
    "stable_minutes": 60,
    "finish_window_minutes": 15,
    "webhook_timeout_minutes": 180
  },
  "report_policy": {
    "healthy": "record locally only",
    "state_change": "write event and optional user summary",
    "failure": "report evidence and ask before destructive recovery"
  },
  "human_gate": {
    "diff_review": true,
    "destructive_actions": true,
    "auto_commit": false
  }
}
```

## 9. Handoff 与 Evidence 机制

### 9.1 Git 作为代码接力

每轮 Codex 结束后，Orchestrator 必须：

1. 检查工作区变更。
2. 运行配置的验证命令。
3. 生成 diff summary。
4. 在允许自动提交时创建 commit。
5. 将 commit sha 写入 turn record。

Commit message 模板：

```text
agent-loop(<loop_id>): turn <n> <short_goal>

Metrics before:
- <primary_metric>: <value>

Intent:
- <one-line implementation intent>
```

### 9.2 Planner 任务计划

每轮 Worker 运行前，Planner 必须写：

`<repo>/.codex/agent-loop/<loop_id>/plan/turn_<n>.json`

建议 schema：

```json
{
  "turn_id": "turn_0003",
  "objective": "降低过拟合并提升 val_f1",
  "hypothesis": "最近两轮训练集提升但验证集停滞，可能需要增强正则或数据增强",
  "tasks": [
    {
      "id": "task_1",
      "type": "code_change",
      "target_files": ["src/train.py", "configs/current.yaml"],
      "instruction": "增加可配置 label smoothing，并默认设为 0.05"
    },
    {
      "id": "task_2",
      "type": "test_change",
      "target_files": ["tests/test_config.py"],
      "instruction": "覆盖新配置字段解析"
    }
  ],
  "expected_impact": {
    "primary_metric": "val_f1",
    "direction": "increase",
    "risk": "可能降低训练集拟合速度"
  },
  "requires_human": false
}
```

同时写：

`<repo>/.codex/agent-loop/<loop_id>/plan/turn_<n>.md`

用于给人类和下一轮 Codex 快速阅读。

### 9.3 Markdown 思维接力棒

每轮必须写：

`<repo>/.codex/agent-loop/<loop_id>/handoff/turn_<n>.md`

内容包括：

- 本轮目标。
- 看到的关键证据。
- 做了哪些代码变更。
- 为什么这样改。
- 预期影响。
- 需要下一轮关注的风险。
- 训练/评估命令。
- 关联 commit、run_id、artifact 路径。

### 9.4 Judge 验收报告

每轮验证或训练结果出现后，Judge 必须写：

`<repo>/.codex/agent-loop/<loop_id>/judge/turn_<n>.json`

建议 schema：

```json
{
  "turn_id": "turn_0003",
  "verdict": "continue_next_iteration",
  "confidence": "medium",
  "accept_change": true,
  "rollback_recommended": false,
  "evidence": [
    "validation passed",
    "val_f1 improved from 0.803 to 0.817",
    "latency regression is within threshold"
  ],
  "risks": [
    "metric still below target 0.82",
    "single run may be noisy"
  ],
  "next_step_recommendation": "try stronger augmentation or repeat with fixed seed",
  "requires_human": false
}
```

`verdict` 可选：

- accept_change
- needs_fix
- continue_next_iteration
- stop_success
- stop_no_progress
- rollback_recommended
- needs_human_review

Orchestrator 必须把 Judge verdict 交给 Policy Engine，再决定真实状态迁移。

### 9.5 Evidence Packet

Orchestrator 调用 Planner 或 Judge 前，先生成 evidence packet：

`<repo>/.codex/agent-loop/<loop_id>/evidence/turn_<n>.json`

内容包括：

- contract 摘要。
- 当前状态。
- 最近 1-3 轮 plan、handoff、judge report。
- metrics trend。
- diff summary。
- validation result。
- log tail 或 failure summary。
- artifact 路径。
- policy constraints。

Evidence packet 是 Codex 的主要输入，避免把大日志和无关上下文塞进 prompt。

### 9.6 注入下一轮 Codex 的上下文

下一轮 Codex prompt 只注入：

- contract 摘要。
- Planner plan 或 Judge report。
- 最近 1-3 轮 handoff。
- 指标趋势表。
- 最新失败摘要或完成摘要。
- Git diff/commit 摘要。
- 必要文件路径。

不注入：

- 大段原始日志。
- 完整 checkpoint。
- 无关历史聊天。
- 重复 healthy_wait 状态。

## 10. Webhook 契约

### 10.1 训练完成回调

`POST /api/v1/loops/{loop_id}/runs/{run_id}/callback`

Headers：

- `X-Agent-Loop-Signature`
- `X-Agent-Loop-Timestamp`
- `Content-Type: application/json`

Body：

```json
{
  "loop_id": "loop_20260624_001",
  "run_id": "run_0003",
  "turn_id": "turn_0003",
  "status": "succeeded",
  "started_at": "2026-06-24T10:00:00Z",
  "finished_at": "2026-06-24T12:41:00Z",
  "metrics": {
    "val_f1": 0.817,
    "val_auc": 0.901,
    "latency_ms": 42.7
  },
  "artifacts": {
    "metrics_path": "runs/run_0003/metrics.json",
    "log_path": "runs/run_0003/train.log",
    "checkpoint_path": "runs/run_0003/best.pt"
  },
  "summary": "Training completed. Best epoch 17.",
  "error": null
}
```

`status` 可选：

- succeeded
- failed
- cancelled
- timeout
- partial

### 10.2 心跳回调

`POST /api/v1/loops/{loop_id}/runs/{run_id}/heartbeat`

用于长任务进度记录，不默认唤醒 Codex。

Body：

```json
{
  "run_id": "run_0003",
  "progress": {
    "epoch": 8,
    "total_epochs": 40,
    "last_metric": 0.793
  },
  "resource": {
    "gpu_util": 81,
    "gpu_mem_gb": 21.4,
    "disk_free_gb": 180.2
  },
  "log_tail": "optional short tail under size limit"
}
```

## 11. API 草案

- `POST /api/v1/loops`：创建 loop。
- `POST /api/v1/loops/{loop_id}/start`：启动或恢复 loop。
- `POST /api/v1/loops/{loop_id}/pause`：暂停，不改变历史。
- `POST /api/v1/loops/{loop_id}/cancel`：取消后续调度。
- `GET /api/v1/loops/{loop_id}`：查询 loop 状态。
- `GET /api/v1/loops/{loop_id}/events`：查询事件流。
- `GET /api/v1/loops/{loop_id}/turns`：查询 Codex turn 历史。
- `POST /api/v1/loops/{loop_id}/runs/{run_id}/callback`：训练完成回调。
- `POST /api/v1/loops/{loop_id}/runs/{run_id}/heartbeat`：训练心跳。
- `POST /api/v1/loops/{loop_id}/approve`：人工批准 diff、重跑或危险动作。

## 12. Codex Prompt 模板

### 12.1 Planner Turn Prompt

```text
你是 Codex Agent Loop 中的 Planner。

边界：
- 你负责基于证据分配下一轮任务。
- 不要修改代码。
- 不要启动训练。
- 不要自行决定 loop 真实停止；可以提出 stop_success 或 stop_no_progress 建议。
- 不要要求读取大日志；只使用 evidence packet 和必要文件路径。

请读取：
- Loop contract: <contract_path>
- Evidence packet: <evidence_packet_path>
- Recent handoff: <handoff_paths>
- Latest judge report: <judge_report_path>

输出要求：
1. 写结构化计划到 <next_plan_json_path>。
2. 写可读计划到 <next_plan_md_path>。
3. 每个任务必须包含 target_files、instruction、expected_impact、risk。
4. 在 final response 中只输出 plan_path、requires_human、risk_notes。
```

### 12.2 Worker Turn Prompt

```text
你是 Codex Agent Loop 中的 Worker。

边界：
- 你负责执行 Planner 分配的代码、配置、测试或文档改进。
- 不要长时间等待训练。
- 不要自行决定 loop 是否终止。
- 不要删除数据、重跑大型实验或做破坏性恢复，除非 contract 已明确允许。

请读取：
- Loop contract: <contract_path>
- Planner plan: <plan_path>
- Evidence packet: <evidence_packet_path>
- Recent handoff: <handoff_paths>
- Git diff/commit summary: <git_summary_path>

本轮任务：
<turn_objective>

完成要求：
1. 做最小必要改动。
2. 更新或新增必要测试/配置。
3. 写 handoff Markdown 到 <next_handoff_path>。
4. 在 final response 中输出：
   - changed_files
   - validation_commands_to_run
   - risk_notes
   - expected_metric_impact
```

### 12.3 Judge Turn Prompt

```text
你是 Codex Agent Loop 中的 Judge。

边界：
- 你负责验收本轮 diff、验证结果、训练 metrics 和失败证据。
- 你可以建议 accept_change、needs_fix、continue_next_iteration、stop_success、stop_no_progress、rollback_recommended、needs_human_review。
- 你的建议不是最终状态迁移；Orchestrator 会用 Policy Engine 校验。
- 不要修改代码。
- 不要启动训练。
- 不要要求读取大日志；只使用 evidence packet、短日志摘要和必要路径。

请读取：
- Loop contract: <contract_path>
- Evidence packet: <evidence_packet_path>
- Diff summary: <diff_summary_path>
- Validation result: <validation_result_path>
- Metrics summary: <metrics_summary_path>

输出要求：
1. 写结构化验收报告到 <judge_json_path>。
2. 写可读验收报告到 <judge_md_path>。
3. 明确 verdict、confidence、accept_change、rollback_recommended、requires_human。
4. 每条结论必须引用 evidence。
5. 在 final response 中只输出 verdict、judge_report_path、requires_human。
```

### 12.4 失败诊断 Prompt

```text
本轮训练失败。请只做最小诊断：
- 阅读 failure summary 和短日志尾部。
- 判断失败类型：环境/数据/代码/指标退化/资源不足/未知。
- 如需破坏性动作或大规模重跑，写明建议并停止。
- 如可用小改动修复，修改代码并写 handoff。
```

## 13. 停止策略

停止策略采用“双层判断”：

1. Codex Judge 给出模型判断，例如 `stop_success`、`stop_no_progress`、`continue_next_iteration`。
2. Orchestrator Policy Engine 校验硬规则、权限、预算、指标阈值和 human_gate。

只有 Policy Engine 通过后，loop 才能进入 completed、failed、paused 或 cancelled。

### 13.1 硬停止

- 达到 `max_turns`。
- 用户取消。
- 训练连续失败超过阈值。
- 资源预算耗尽。
- contract 标记为不可继续。

### 13.2 指标停止

- primary metric 达到目标。
- 连续 `patience` 轮提升小于 `min_delta`。
- 新变更导致关键回归超过阈值。
- benchmark 置信区间显示无有效改善。

### 13.3 完成验证

进入 completed 前必须：

1. 最新 metrics 满足 success criteria。
2. 配置的验证命令通过。
3. Codex Judge 给出 `stop_success` 或 Orchestrator 规则直接判定成功。
4. Policy Engine 确认没有 human_gate、回归、预算或审计阻塞。
5. Git 工作区干净或 pending diff 被明确记录。
6. 生成 final report。

## 14. 安全与权限

### 14.1 Sandbox 策略

MVP 默认：

- Codex 改代码 turn：workspace write。
- Codex review turn：read only。
- 高信任本地研究环境可配置 full access，但必须记录到 contract。

### 14.2 审批边界

必须人工确认：

- 删除数据、checkpoint、日志或实验目录。
- 覆盖远程分支。
- 安装系统级依赖。
- 修改训练数据生成逻辑并影响可复现性。
- 重跑高成本实验。
- 自动 merge 或部署。

### 14.3 Webhook 安全

- 回调必须签名校验。
- run_id 幂等。
- 过期 timestamp 拒绝。
- payload 大小限制。
- 日志正文默认不接受大块上传，只接受路径或短摘要。

## 15. 可观测性

事件类型：

- loop.created
- loop.started
- codex.turn.started
- codex.turn.completed
- codex.planner.completed
- codex.worker.completed
- codex.judge.completed
- policy.checked
- git.commit.created
- validation.started
- validation.failed
- run.started
- run.heartbeat
- run.completed
- decision.made
- loop.completed
- loop.failed
- loop.paused

每个事件包含：

- event_id
- loop_id
- turn_id
- run_id
- timestamp
- decision
- evidence
- artifact_refs

Dashboard MVP 只需要 CLI/API 查询；Web UI 后置。

## 16. MVP 范围

MVP 必须完成：

1. 创建 loop contract。
2. 使用 Codex SDK 启动 Planner turn，生成下一轮 plan。
3. 使用 Codex SDK 启动 Worker turn，执行 plan 并写 handoff Markdown。
4. 检查 diff、运行验证命令。
5. 使用 Codex SDK 启动 Judge turn，评估 diff、验证结果、metrics 或失败证据。
6. Policy Engine 根据 Judge 输出、max_turns、target metric、patience、human_gate 做状态迁移。
7. 在策略允许时创建 Git commit。
8. 启动一个后台训练命令。
9. 接收 webhook metrics。
10. 保存事件、turn、run、metrics、plan、handoff、judge report 到 SQLite 和 artifact 目录。
11. 提供暂停、恢复、取消能力。
12. 生成 final report。

MVP 可暂缓：

- Web UI。
- 多项目多租户。
- 云队列。
- 自动 PR/merge。
- 复杂权限系统。
- 自动超参搜索器。

## 17. 验收标准

### 17.1 功能验收

- 给定一个 5 秒模拟训练脚本，系统能跑通 3 轮：Planner -> Worker -> validation -> Judge -> Policy -> commit -> train -> webhook -> next decision。
- webhook 重复发送不会重复触发下一轮。
- Codex turn 结束后，长训练期间没有 Codex token 持续消耗。
- 每轮都有 Git commit 或明确的 no-change record。
- 每轮都有 plan、handoff 和 judge report。
- 每轮都有 handoff Markdown。
- 达到目标指标后，Judge 提出 `stop_success` 或 Policy Engine 直接判定成功，随后进入 completed_verify 并生成 final report。

### 17.2 稳定性验收

- API Server 重启后可从 SQLite 和 artifact 恢复 loop 状态。
- 训练进程丢失或 webhook 超时会进入 failed_needs_action 或 blocked_needs_user。
- 大日志不会进入 Codex prompt。
- 用户暂停后不会启动新的 Codex turn 或训练 run。

### 17.3 审计验收

- 任意 turn 能追溯到：输入 metrics、Planner plan、Worker prompt 摘要、修改文件、Judge report、Policy result、commit、验证结果、训练 run、下一轮决策。
- final report 能列出指标趋势、关键改动和停止原因。

## 18. 实现里程碑

### Milestone 0：模拟闭环

- FastAPI skeleton。
- SQLite schema。
- fake_train.py，完成后回调 webhook。
- 单 loop、单仓库、单指标闭环。

### Milestone 1：Codex SDK 接入

- Codex Runner。
- Planner/Worker/Judge prompt 模板。
- handoff 检查。
- plan 和 judge report 检查。
- Git commit 自动化。

### Milestone 2：策略与恢复

- patience/min_delta/max_turns。
- Policy Engine。
- webhook 幂等。
- pause/resume/cancel。
- watchdog timeout。

### Milestone 3：研究可用性

- 多指标趋势。
- final report。
- artifact browser via API。
- human_gate。

### Milestone 4：工程化扩展

- PR 创建。
- 队列/worker。
- 多 loop 并发。
- UI。
- 权限与团队审计。

## 19. 关键风险

- Codex SDK 版本成熟度：Python SDK 当前适合作为 MVP 快速接入，但需锁版本并保留 TypeScript sidecar 方案。
- 自动改代码质量：必须用验证命令、Git diff、人工 gate 控制风险。
- 指标噪声：训练指标有随机性，停止策略应支持 min_delta、patience、重复验证。
- 环境漂移：contract 需要记录依赖、命令、数据版本、seed、硬件摘要。
- 长任务回调丢失：需要 watchdog 和可恢复状态文件。

## 20. 官方依据与设计来源

- Codex SDK 官方文档说明 SDK 用于以编程方式控制本地 Codex agent，适合 CI/CD、内部工具和应用集成；TypeScript SDK 支持 startThread/run/resumeThread，Python SDK 支持 AsyncCodex、thread_start/run 和 sandbox preset。
- Codex app-server 官方文档说明 app-server 面向深度产品集成、认证、会话历史、审批和流式事件；自动化 job 或 CI 场景优先使用 Codex SDK。
- self-agent-loop 技能提供的关键启发：operational pause、loop contract、健康多信号判定、低噪报告、resume deliberate、Codex turn 不持续等待长任务。
