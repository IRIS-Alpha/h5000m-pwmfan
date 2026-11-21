# Project Working Agreement

## Delivery

- Work in bounded task blocks. Each block states its goal, expected changes, verification, and acceptance condition in `docs/TASKS.md`.
- Update the task tracker one item at a time. Mark an item complete when its acceptance condition is met, and record a brief dated note for meaningful work.
- When blocked, pause that task block and record the blocker, evidence, and dependency in `docs/TASKS.md`. Continue independent work when possible.
- Once a requirement is confirmed, close its discussion and implement it. Reopen it only when new evidence, a conflict, or a material safety concern appears.
- Keep the current development goal focused on the confirmed target-drive behavior and its offline control tests.

## Decisions and Coordination

- Add decisions to formal requirements only after they are confirmed. Keep unresolved proposals in a clearly labeled discussion section.
- Commit each confirmed requirements update after verification. Use judgment about when to commit other changes.
- Confirm material disagreements about behavior, safety policy, or user-configurable parameter ranges promptly; do not silently turn an unresolved proposal into a requirement.
- Before assigning work to another agent, state the concrete value of delegation and the independent result it is expected to produce. Do not delegate when parallel work has no meaningful benefit.

## Frontend Skill Stages

- For page design or structural redesign, use the project-local `$frontend-design` skill and follow confirmed requirements plus the Vantage theme reference.
- For repeated visual refinement against the running preview, use `$impeccable`; inspect the rendered page and apply its craft guidance before UI edits.
- Before completing a UI task, use `$web-design-guidelines` on the changed interface files and resolve applicable findings.
- Keep these stages distinct: use design guidance while forming the UI, Impeccable during visual iteration, and Web Design Guidelines for the final review.

## Device Access and Reference Work

- Prefer read-only SSH for router observations when it is more direct and reliable than browser interaction. The router is locally managed by the user; avoid browser simulation for routine device data collection.
- If the router's SSH host key changes, refresh the entry for that router in `known_hosts` and accept the presented replacement key. Do not disable host-key checking globally.
- Use browser automation primarily for development previews and visual checks. Web browsing for research is a separate use case.
- Do not change live PWM, thermal-zone, or cooling-map behavior until the required evidence and rollback procedure are reviewed.
