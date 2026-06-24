# Product Review Scorecard

This scorecard records the two product-management refinement rounds applied to CALO.

## Round 1: Product Problem Clarity

Inputs used:

- Jobs-to-be-Done: clarify functional, emotional, and social jobs.
- PRD Development: connect problem, users, solution, risks, and success criteria.
- Opportunity Solution Tree: connect desired outcome to opportunities, solutions, and experiments.

Changes made:

- Added primary persona, current alternatives, buying trigger, jobs, pains, and desired gains to the PRD.
- Added an opportunity-solution tree for goal brief, operational pause, policy boundary, and auditability.
- Added product success metrics, activation metrics, quality metrics, and guardrails.
- Updated architecture from a linear training loop to goal brief -> task graph -> TaskRun -> operational pause -> Judge/Policy.

## Round 2: Positioning And Roadmap Clarity

Inputs used:

- Positioning Statement: sharpen target, need, category, benefit, and differentiation.
- Roadmap Planning: separate Now, Next, Later instead of blending MVP with future product UX.
- Workshop Facilitation: make the flow understandable as a guided product experience, not a raw config exercise.

Changes made:

- Added README positioning statement and differentiation against tmux scripts, notebooks, and long-running model sessions.
- Added "What This Replaces" and "Current Gap" to avoid overstating the current MVP.
- Added a Now/Next/Later product roadmap.
- Reframed the HTTP API and async docs around TaskRun-first language while preserving current contract JSON reality.

## Evaluation Rubric

Score each dimension from 1 to 10.

| Dimension | What Good Looks Like | Weight |
| --- | --- | --- |
| Problem clarity | Target users, jobs, pains, and alternatives are explicit and specific. | 20% |
| Product flow | User-facing flow starts with a goal brief and cleanly maps to task graph, TaskRun, pause, wake, and judgment. | 20% |
| Control boundary | Codex SDK, Orchestrator, PolicyEngine, and TaskOrchestrator responsibilities are hard and testable. | 20% |
| MVP honesty | Current implementation, gaps, and roadmap are clearly separated. | 15% |
| Engineering readiness | Requirements, APIs, artifacts, acceptance criteria, and risk controls are actionable. | 15% |
| Usability/readability | README and PRD are understandable without needing prior conversation context. | 10% |

Exit threshold: weighted score > 7.5/10 after two refinement rounds.

