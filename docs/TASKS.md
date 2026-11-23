# Project task tracker

## Completed task block: Project-local frontend skills

- Goal: configure the three requested design and review skills inside this repository.
- Expected changes: add the complete skill resources under `.agents/skills/`, document their intended stages and pinned upstream sources, and add project routing guidance.
- Progress:
  - [x] Install `frontend-design`, `impeccable`, and `web-design-guidelines` with their required references and helper files.
  - [x] Document the design, visual-iteration, and final-review stages in `.agents/skills/README.md` and `AGENTS.md`.
  - [x] Preserve the upstream licenses/notices that are provided and record the source commit for each skill.
- Verification: confirm all three skill entry files and referenced supporting files exist; inspect repository status and whitespace checks.
- Acceptance: Codex can discover each project-local skill by its frontmatter name, and the project documentation identifies when to use it.
- Status: complete; project-local skill packages and stage routing are in place. Impeccable hooks remain opt-in.

## Completed task block: Fixed-request controls visual follow-up

- Goal: incorporate five browser comments against the local development preview.
- Expected changes: record the confirmed UI requirements in `docs/REQUIREMENTS_V3.md`; keep top status/language controls equal-sized with whitespace around them; keep the fixed-request label, wake-style slider, value and stop button aligned on one row; separate history units from number fields.
- Progress:
  - [x] Keep status and language controls equal-sized with visible whitespace between them.
  - [x] Align request label, slider, value and stop action on one row across mobile widths.
  - [x] Apply Wake-style tick marks and fading active trail to the keyboard-accessible range input.
  - [x] Add separation between history number fields and their units.
- Verification: strict checks, diff checks, and local preview visual/interaction checks at 320, 390, 500, 651px and desktop in light/dark themes.
- Verification: `STRICT=1 sh tools/check.sh` (33/33), JavaScript syntax checks, `git diff --check`, and ego-browser measurements at 320, 390, 500, 651, and 1360px in both themes; slider keyboard input advanced by exactly 10%.
- Acceptance: controls remain aligned without horizontal overflow; slider stays keyboard-accessible and keeps 10% steps and unchanged submission semantics.

## Completed task block: UI interaction and responsive corrections

- Goal: implement the confirmed V3 dashboard and advanced-settings corrections against the local development build.
- Expected changes: document the confirmed choices, separate fixed requests from curve presets, clarify selected state, unify chart folding and parameter placement, use five chart intervals, improve history controls/status, and fix the narrow advanced source field.
- Progress:
  - [x] Separate fixed 10–100% requests and stop action from the five curve presets, with mutually exclusive selected states.
  - [x] Preserve the independent stop request and global protection arbitration; verify fixed PWM conversion and 10% validation offline.
  - [x] Move target/custom parameters into the curve-preset block; fold the fan chart and keep its parameter editor folded by default.
  - [x] Render six tick marks on chart axes; allow custom history windows in 5-minute steps and 1–60-second sampling.
  - [x] Move history state into its heading, remove the duplicate advanced-settings link, and match top status/language sizing.
  - [x] Clarify kernel takeover and controller-vs-chart sampling text; expand the curve-source selector to its field width.
  - [x] Check the local preview at 320, 390, 500, and desktop widths in light/dark themes.
- Verification: `STRICT=1 sh tools/check.sh`, `git diff --check`, `node --check tests/preview.mjs`, and the Windows `ego-browser` preview at 500px and desktop in both themes. The standalone `node tests/preview.mjs` runner could not start because WSL has no `playwright` module; equivalent primary interactions were inspected in the local preview.
- Acceptance: local preview matches the confirmed V3 interaction; no width overflow or unequal top controls; all chart axes render six equally spaced ticks; history time ranges divide into five equal minute intervals.
- Status: complete; local preview and offline control checks passed.
- 2026-11-21: Implemented fixed-duty mode through the existing temperature-protection dispatch, updated the dashboard and advanced controls, and verified responsive layout, equal top controls, bilingual labels, fold behavior, and six chart ticks in the local preview. No router control files or live PWM state were changed.

## Completed task block: PI composition

- Goal: compose target-drive feed-forward PWM with bounded PI correction in a deterministic offline helper.
- Expected changes: optional integral freeze in the PI helper; output clamping with anti-windup when saturation is driven further by the current error; focused Bats coverage.
- Verification: `shfmt`, `STRICT=1 sh tools/check.sh`, and `git diff --check`.
- Acceptance: the helper returns bounded PWM, correction, and integral state; protected/frozen calls preserve the integral; saturation does not accumulate integral in the saturating direction.
- Status: complete; PI composition, integral freeze, saturation, and anti-windup cases pass offline tests.

## Completed task block: global protection boundaries

- Goal: verify global temperature protection boundary transitions and invalid-input handling offline.
- Expected changes: focused Bats cases and task log; no PWM service or device changes.
- Verification: `shfmt`, `STRICT=1 sh tools/check.sh`, and `git diff --check`.
- Acceptance: acceleration onset, threshold lock, exact release hysteresis, equal target/threshold, and invalid configuration all have deterministic assertions.
- Status: complete; all declared global-protection transition and validation cases pass offline.

## Completed task block: bounded fan-service pause

- Goal: observe kernel PWM behavior during a bounded pause of the existing fan service.
- Expected changes: record the recovery procedure and live samples.
- Verification: confirm the service is absent during sampling and resumes with fresh status afterwards.
- Acceptance: record what the observed temperature range establishes and keep unverified control boundaries open.
- Status: complete for the bounded sample; trip transition verification remains queued.

## Completed task block: protected target-drive cycle

- Goal: calculate the PI freeze decision from the global protection state on each offline target-drive cycle.
- Verification: run the strict package checks and cover protection onset, lock, release ramp, recovery, and fault paths.
- Acceptance: freeze the integral while protection is active and use only the current elapsed interval when normal control resumes.
- Status: complete for offline calculation; integration with the live service remains queued.

## Completed task block: protection history storage

- Goal: retain protection counters, the latest event and its peak across daemon restarts within one boot.
- Expected changes: an atomic history snapshot, read-only status projection, and tests using temporary files. The snapshot path is `/var/run/h5000m-pwmfan/protection-history`.
- Verification: run the strict package checks and test relock, restart, time-window expiry, and unreadable or invalid snapshots.
- Acceptance: a fresh reader can restore a valid snapshot. Invalid state and failed updates leave the prior snapshot intact.
- Status: complete for storage and status reads. The daemon writer remains queued with runtime control integration. The runtime directory retains history across daemon restarts during the same router boot.

## Completed task block: V3 interactive preview

- Goal: render the V3 dashboard and advanced settings using the package views and local Vantage theme assets.
- Expected changes: six-mode dispatch, fixed-node curve editing, four-channel history, control-source presentation, advanced protection settings, and an offline browser launcher.
- Verification: test view interaction, English and Chinese strings, and light, dark, and automatic themes across desktop and narrow mobile viewports.
- Acceptance: a reproducible browser preview, with generated sensor samples and explicit runtime ownership states.
- Status: complete for the preview. The confirmed V3 rules drive the dashboard and advanced settings; Playwright verified 320/390/1360px layouts and settings interactions.

## Completed task block: V3 controller and history fixture

- Goal: connect the V3 control cycle and bounded temperature history for offline verification.
- Expected changes: six-mode settings, protection and PI state, status fields, and shared temperature history across page reloads.
- Verification: strict checks and a fake PWM fixture for off, lock/release, sensor failure, and output mismatch.
- Acceptance: history can be loaded on a fresh page, unknown control sources stay unknown, and the active path stays gated until hardware ownership is verified.
- Status: complete for the fixture and preview. Physical takeover, the matching SDK package build, and installation checks remain separate tasks.

## Work queue

- [x] 接管时的触点上调：接管启动把最冷两个 `pwm-fan` 触点改为 1000 与“下一触点 − 1000”，释放时恢复；顺带修复 `user_space` 的历史残留（2026-11-22）。
- [x] 占空比类模式立即生效：把回差保持与降速等待限定在温度驱动请求上（`hold_down_allowed()`），固定请求与 `drive=duty` 的预设改多少立刻下发。
- [x] 连续点击的误报：同值提交连带跳过 `save`/`apply`，`uci.apply` 遇 ubus code 5 自动重试一次，提交期间控件不再禁用而是进队列。
- [x] 界面缺陷修复（2026-11-22）：滑块圆点改为自绘并按 `--pf-ratio` 定位；警示标签出现时快闪两次；图表不再依赖 `requestAnimationFrame` 并与标签页可见性联动；下发失败改为 `uci revert` 丢弃暂存，确认失败才提示（code 5 且 `uci changes` 已空时视为已生效）。
- [x] 交互与视觉修订（2026-11-22）：选中态高亮移到整个模式容器并加边框流光；警示标签加圆点、底色与长周期呼吸；折叠面板展开状态写入本地存储；语言交换器改为 CN/EN 两态；绘图区在无数据或画布尺寸为 0 时显示“无数据 · 请刷新页面”并按 250 毫秒重试。
- [x] Select Apache-2.0 for the package and include the canonical license text and package metadata.
- [x] Confirm the current delivery path: compile the package into firmware and validate locally produced APKs; defer a router-facing package feed and its signing setup until the plugin is stable.

- [x] Establish independent package repository and preserve handoff.
- [x] Configure lightweight engineering checks and planning documents.
- [x] Confirm Vantage upstream and theme integration approach.
- [x] Freeze initial v1 control and failure-state contract; hardware thresholds remain provisional.
- [x] Implement initial package metadata, UCI defaults, procd service, and controller.
- [x] Add initial isolated curve-helper tests; sensor/ownership/failsafe tests remain queued.
- [x] Restore non-interactive WSL SSH access to H5000M.
- [x] Observe CPU trips, governor, cooling-device state, PWM readback, and fan service status while the installed controller is running.
- [x] Sample PWM and thermal state during a bounded pause of the installed fan controller, then verify service restoration.
- [x] Confirm the kernel request on a natural trip crossing after fan replacement and stock controller baseline verification. Measured on 2026-11-24 in a user-approved L1 window (`tools/l1-release.sh`, `tools/l1-poke.sh`, results in `docs/RUNTIME_EVIDENCE.md`): restoring the trips makes the kernel re-evaluate the zone and `cooling_device0/cur_state` jumps to max (3), but the kernel does not regulate afterwards -- a manual `pwm1=51` stayed at 51 for 20 s on the lowest trip and nothing pushed it back. So a release leaves the fan at 255 until the plugin writes again or the router reboots: thermally safe, audibly obvious, not a modulated hand-over. `docs/ROLLBACK.md` now says that and its abort list no longer treats a held 255 as a fault. Above 85 °C remains unobserved (would need the SoC heated past it).
- [x] Add project working agreement and reconcile V3 historical discussion with confirmed control decisions.
- [x] Add deterministic pure helpers for target-drive interpolation/blending, bounded PI anti-windup, and global-protection transitions with offline boundary tests.
- [x] Confirm and test target temperature, response interval, and transition-width limits, including zero-degree onset and automatic width compression.
- [x] Verify that the target-drive controller preserves 0% below the response and recomputes PI correction after discarding saturated integration.
- [x] Verify offline protection dispatch with output from any mode, including off, startup boost, repeated lock cycles, a per-cycle count, and fault handling. Check with `STRICT=1 sh tools/check.sh`.
- [x] Exercise target drive and protection together in a simulated temperature sequence. Verify equal thresholds, 100% override, integral freeze and resume, and the reported control source.
- [x] Verify automatic PI integral freeze and recovery in the offline target-drive cycle.
- [x] Wire PI freeze and recovery, control timing, and source reporting into the offline controller fixture.
- [x] Compute protection history offline and verify the 24-hour window, cumulative count, latest trigger, cycle peak, and invalid history handling.
- [x] Verify the protection history snapshot and status reader in isolation.
- [x] Verify the daemon protection-history writer against an isolated PWM fixture.
- [ ] Gate live PWM/thermal integration on reviewed runtime evidence and a device rollback procedure. Both artefacts exist as of 2026-11-24 (`docs/RUNTIME_EVIDENCE.md`, `docs/ROLLBACK.md`) and the natural-crossing observation is done; what is missing is a human read of the two documents.
- [ ] Build and validate the firmware APK with the matching OWT2510 ImmortalWrt buildroot/SDK. The available October SDK produced compatibility APKs only; they are unsigned by the device trust key and its LuCI revision differs from the installed firmware.
- [x] Recover the pinned source revision for firmware `r0-a4ba824` and identify the candidate CI run; the hash is the upstream ImmortalWrt commit `a4ba8240d8a1aaef7e8c6f2d65e841a9bfd2b8c5` (2026-11-14), not a commit of the firmware repository, and the build is run `43568494545` of `IRIS-Alpha/H5000M-CI-Qmodem-OP`. Byte-level provenance remains open because the repository publishes no releases and the run artifacts expired; details in `docs/FIRMWARE_PROVENANCE.md`.
- [x] Implement one-page LuCI status/control view, ACL/menu, quick dispatch, UCI settings, and zh-Hans translation package.
- [x] Verify the V3 views under Vantage light/dark/auto and at 320/390/1360px with Playwright and the local firmware assets.
- [x] Apply the four accepted visual corrections and the §13/§14 header sizing rule to the local views; verify at 320/390/500/651/1360px in light and dark.
- [x] Reconcile the V4 handoff documents with this tracker, confirm the workspace baselines, and keep the five undecided behaviour items unresolved.
- [x] Verify the installed Simplified Chinese translation package with the matching SDK/APK on the device (done 2026-11-22: both views swept on the router with cache disabled; only brand names remain in Latin script; the legacy `luci-i18n-h5000m-fancontrol-zh-cn` catalogue was restored from `/tmp/h5000m-backup/` after the feed turned out to be unreachable, so its menu entry is Chinese again and our unique msgids keep 安静/平衡/性能).
- [ ] Prepare optional H5000M thermal-map integration patch for later main-project feature.
- [x] Confirm zero-duty semantics, control-source placement, statistics removal, and defer the language control (2026-11-22).
- [x] Implement Block B control semantics: 1% fixed-request step without a stop button, control source in the badge, statistics line removed.
- [x] Implement the confirmed top-area, mode-selection, fixed-request, and warning redesign from the expanded V4 proposal set.
- [x] Settle the two open proposal items: no advanced-settings “mode minimum apply interval” control (the merge window stays a dashboard constant) and no dashboard LuCI action bar (the dashboard commits directly, curve parameters commit explicitly) (2026-11-22).
- [x] Curve-panel refinements: the six-point editor is a single-column table (header row `#`/温度/输出, one shared label set instead of twelve), capped at 460px, verified at 320/390/1360px (2026-11-22).
- [x] Hardware validation and rollback procedure. The rollback runbook is `docs/ROLLBACK.md` (five levels, abort criteria, what a rollback does *not* restore) and the read-only snapshot tool is `tools/device-snapshot.sh`. The three manual facts are confirmed by the user on 2026-11-24: a standstill fan starts through the kick and then holds; the lowest duty that keeps the new fan turning is 8 % (kick off, floor off, 1 % steps); the kick has been verified repeatedly. The device has no tachometer, so these stay reports rather than measurements. The natural-crossing observation is tracked as its own item above.

- 2026-11-24: Wrote `docs/RUNTIME_EVIDENCE.md` for the live-PWM gate. It separates measured facts (one `cpu-thermal` zone, three fan trips all bound to `cooling_device0` with `max_state 3`, `cur_state 0` while the plugin owns the fan, `pwm1` 51, no tachometer, 58.5 ms per cycle = 2.9 % of one core, 1.6 MB RSS) from code-read facts (request pipeline at `root/usr/sbin/h5000m-pwmfan:430`, floor exception for 0 %, modem floor at 601, kick clamp at 616, release writing 255 at 269, takeover pin/restore at `controller-lib.sh:538`/`:570`) and from the user's own manual verifications (start from standstill via the kick, 8 % minimum spin, kick verified). Also recorded that `control_source` and `safety_source` can be different sensors (46.4 vs 51.3 under `auto`), and that the remaining open item is one observation of the kernel taking the fan back after an L1 release.

- 2026-11-24: Ran the approved L1 release observation twice. Release writes 255 and the kernel jumps `cur_state` to 3 the moment the trips are restored -- so the trip write really does wake the zone -- but it never takes over the duty: a hand-written 51 held for 20 s on the 40 °C trip, and the driver reset `cur_state` to 0 when that write landed. Both runs restored `enabled=1` and re-pinned the trips (114000 / 1000); the plugin came back at `state=running`. Conclusion written into `docs/RUNTIME_EVIDENCE.md` (new section with both tables) and `docs/ROLLBACK.md` (L1 now says a released fan sits at 255, and the abort list no longer treats that as a fault). Also recorded why `min_pwm` defaults to 20 %: 8 % is the factory data of a new fan, and the unstartable band only grows with variation and wear.

## Deferred until the plugin is stable

- [ ] Decide whether to submit to an official feed or maintain a self-hosted APK repository; add index signing and device trust only if standalone package updates are still desired. Parked by the user on 2026-11-24 until the plugin is stable; the matching-SDK build below stays blocked on this decision.

- 2026-11-21: Recorded and implemented five local-preview UI corrections: top-control spacing, fixed-request label/slider/stop alignment, Wake-style slider feedback, and history unit spacing. Verified all 10 mobile/desktop theme combinations with no horizontal overflow and confirmed 10% keyboard increments.

## Completed task block: UI/UX backlog verification

- Goal: verify the accepted visual backlog against the current local preview, then settle interaction questions before implementation.
- Expected changes: first record findings and decisions; update formal requirements only after the user confirms unresolved behavior or parameter choices.
- Progress:
  - [x] Add the four previously observed visual issues to the improvement backlog.
  - [x] Record the newly requested header, mode-selection, fixed-request, warning, accordion, history-settings, LuCI-action, and advanced-settings proposals.
  - [x] Rechecked at 320, 390, 500, 651px and desktop in light/dark themes, including expanded parameter sections and the sticky save bar.
  - [x] Reported apply timing, minimum interval, zero-duty semantics, warning triggers, and the V3 conflicts in `docs/UIUX_RECHECK_2026-11-22.md`.
- Verification: local preview screenshots/measurements, interaction-state inspection, and `git diff --check` for documentation changes.
- Acceptance: each visual finding is confirmed, fixed, deferred, or marked not reproducible; unresolved behavior is not silently promoted to formal requirements.
- Status: verification complete; the four findings were fixed in the follow-up pure-styling block below. Decisions on zero-duty semantics, the apply model, and the 3-second interval remain open for Block B. Report: `docs/UIUX_RECHECK_2026-11-22.md`.

## Completed task block: pure styling corrections (Block A)

- Goal: fix the four confirmed visual findings without changing control behaviour, submission semantics, or configured values.
- Expected changes: history-axis label thinning, advanced-page heading and module tokens, docked command bar, preset/drive mode grouping, and the §13/§14 header sizing rule.
- Progress:
  - [x] `htdocs/luci-static/resources/view/h5000m-pwmfan.js`: thin history-axis labels from the measured label width and tick spacing while keeping six grid ticks (`[0, 2, 5]` at 320px, all six from 390px).
  - [x] `htdocs/luci-static/resources/view/h5000m-pwmfan.css`: presets and parameterised modes render as 3 + 2 columns at every width; status and language controls keep equal width/height with a 172px cap.
  - [x] `htdocs/luci-static/resources/view/h5000m-pwmfan-advanced.js`: one heading plus subtitle from `form.Map`, theme card and 460px field cap restored, secondary back link, command bar docked to the form end.
- Verification: `node --check` on both views; `STRICT=1 sh tools/check.sh` 33/33; local preview at 320/390/500/651/1360px in light and dark with measured geometry and no horizontal overflow.
- Acceptance: each finding is fixed in the local preview with no behaviour change.
- Status: complete for styling. Block B behaviour items (zero-duty semantics, apply timing, 3-second interval) stay queued and unimplemented.

## Completed task block: Block B — control semantics and status consolidation

- Goal: implement the confirmed control-semantics changes and keep the documentation aligned with them.
- Confirmed decisions (user, 2026-11-22):
  - Fixed request uses a 1% step over 0–100%; the separate stop action is removed and 0% is the stop request, with a visible warning that is not colour-only.
  - The protection statistics line leaves the dashboard; the control source moves into the running badge.
  - The language control keeps its three options until the mobile header layout is settled.
- Confirmed apply model: per-control commits, drag-does-not-commit plus one shared 3-second trailing merge for modes and the fixed slider, no backend slew limit (`docs/REQUIREMENTS_V3.md` §16).
- Expected changes:
  - [x] `root/usr/sbin/h5000m-pwmfan`: accept `fixed_duty` 0–100 in 1% steps; keep `requested_pwm` so a 0% request yields 0 and any non-zero request still respects `min_pwm`. Done 2026-11-22, together with the scheme-A `off` alias.
  - [x] `tests/controller-lib.bats`: replaced the 10%-step rejection with 0% and 1% acceptance plus an out-of-range rejection; asserts `requested_pwm=0` at 0% and the 51 floor at 1%. Done 2026-11-22.
  - [x] `htdocs/luci-static/resources/view/h5000m-pwmfan.js`: slider `min:0 step:1` with − / + steppers and a floating readout bubble, stop button removed, stop warning driven by the live request and the actual output, control source merged into the badge, statistics line removed, shared 3-second trailing merge with the `应用中 N 秒` countdown in the title-row state slot and the 0% bypass. Done 2026-11-22.
  - [x] `htdocs/luci-static/resources/view/h5000m-pwmfan.js`: single header row “风扇控制” + badge + single-block theme and language switchers; “快速调度” renamed to “模式选择”; the theme switcher owns `data-darkmode`/`color-scheme` and mirrors `vantage_theme.appearance` only when that config exists. Done 2026-11-22.
  - [x] `htdocs/luci-static/resources/view/h5000m-pwmfan.css`: three-row fixed request, stepper, slider track and bubble, warning chips with the divider and smaller slogan, switch buttons, hover/focus states, and a reduced-motion guard. Done 2026-11-22.
  - [x] Translations (`po/zh_Hans`) and `menu.d` titles renamed to 风扇控制 / 高级设置. Done 2026-11-22.
  - [x] `htdocs/luci-static/resources/view/h5000m-pwmfan.js`/`.css`: warning chips moved into the “模式选择” header row, the slogan on its own divider-separated line, target parameters and curve points switched to explicit commit with a `待应用` state slot and an `撤销` action. Done 2026-11-22.
- Verification: `STRICT=1 sh tools/check.sh` 33/33; local preview at 320/390/500/651/1360px in light and dark with no horizontal overflow; merged states observed as `应用中 3 秒` → `应用中 2 秒` → `已选`; the 0% request committed without waiting; a click made during a save was queued and applied afterwards.
- Status: dashboard work complete, including the warning relocation, the explicit-commit model for target parameters and curve points, and the curve-panel table layout.
- Acceptance: 0% is reachable without the stop button and reports 0 requested PWM on the fixture; non-zero values still respect the minimum; one badge shows state and source; no statistics line; the language control is unchanged.
- Status: started 2026-11-22; the apply model is settled, so the remaining work is implementation.

- [x] `mode=off` 退场：先落了方案 A（别名映射 `fixed` + `fixed_duty=0`，删掉 `requested_pwm` 的 `off:*` 分支），只读核对路由器 `uci show h5000m_pwmfan` 确认只有 `mode='quiet'`、无 `off` 配置，随后升级到方案 B：白名单与别名一并删除，看板不再识别 `off`（2026-11-22）。
- [x] 固定请求滑块与模式切换共用 3 秒尾随合并器：拖动只更新读数、松手才提交、0% 绕过合并立即提交、标题行显示“应用中-Ns”；不做后端步进限幅（已定案，见 `REQUIREMENTS_V3.md` §16）。已实现并复核：`MERGE_DELAY = 3000`（`h5000m-pwmfan.js:27`）、`scheduleCommit()` 写 `pending.until` 并由 400ms ticker 刷新 `Applying in %s s`（`:218-229`、`:370`）、`Number(changes.fixed_duty) === 0` 立即 `flushPending()`（`:221`）。

- 2026-11-22: Read-only probe of the V4 proposals (header row, breadcrumb naming, theme switcher source, warning row, fold parameters); findings and three header options recorded in `docs/UIUX_RECHECK_2026-11-22.md` §八.
- 2026-11-22: Relocated the warning chips to the “模式选择” header row and the slogan to its own line, and added the explicit-commit model for target parameters and curve points; verified 320/360/390/500/651px with no horizontal overflow, states `已选` → `待应用` → `已选`.
- 2026-11-22: Rebuilt the six-point curve editor as a single-column table with one shared header row, table-style row separators and a 460px cap; inputs widened to 104px at 320px, rows 45px tall, no horizontal overflow at 320/390/1360px.
- 2026-11-22: Retired `mode=off`: the allowlist no longer accepts it, the legacy alias and the redundant `off` checks in the control path and the dashboard are gone, and the dispatch fixture drives the takeover/protection case through `fixed_duty=0`. 33 Bats tests pass.
- 2026-11-22: Widened the gap between the warning chips and the slogan divider to 14px (the `.pf-page :is(h2, h3, p)` reset had nulled the note margin) and made the slider bubble reliable on touch: `pointerdown` focuses the slider and an `is-live` class keeps the bubble visible for 900ms after release.
- 2026-11-22: Restyled the fixed-request slider: a 4px pill track whose fill is computed from the thumb centre, an 18px thumb that lifts with a soft halo while dragging, and a floating chip readout with rolling digits whose width grows a column at a time; the theme focus glow is suppressed in favour of a thumb ring, and the bubble lingers 700ms after release.
- 2026-11-22: The local preview shell now renders the view alone; the simulated-data tag and its theme select are gone, and the page's own switcher (persisted under `pwmfan-theme`) drives light/dark.
- 2026-11-22: Built `luci-app-h5000m-pwmfan-0.1.0-r2` and `luci-i18n-h5000m-pwmfan-zh-cn` from the local SDK (the base feed is a symlink target that does not exist, so the copy used an empty `LUCI_DEPENDS` and the package built alone), installed both on the router and verified the deployed page: title 风扇控制, tabs 风扇控制/高级设置, five modes, no legacy 停转 button, warning chips hidden while no condition holds. Two device-only observations remain: `state=disabled reason=takeover_pending` is the deliberate V3 gate (`kernel_takeover_ready()` returns 1), and the mode labels still read 静音/均衡 because the legacy `luci-i18n-h5000m-fancontrol-zh-cn` catalogue registers the same `Quiet`/`Balanced` msgids and wins in LuCI's shared dictionary.
- 2026-11-22: The device still showed 静音/均衡 because LuCI merges every installed catalogue into one dictionary and the legacy `luci-i18n-h5000m-fancontrol-zh-cn` (静音/均衡) plus `base.zh-cn` (均衡) win for those msgids. Removed the legacy i18n package (its `.lmo` is backed up at `/tmp/h5000m-backup/` on the router) and made the three preset msgids unique (`Quiet mode`/`Balanced mode`/`Performance mode`), so the Chinese labels no longer depend on load order. English labels now wrap at ≤380px instead of being clipped, and the Chinese layout is unchanged at 34px.
- 2026-11-22: Swept both device views for Latin-script leftovers; the only hits are brand names and inline script/style text. Restoring the legacy catalogue file (the package was removed, and the snapshot feed returned `unexpected end of file`, so the `.lmo` was copied back from the backup) fixed its menu entry without re-introducing the msgid collision, because the three preset msgids no longer overlap.
- 2026-11-22: Traced `r0-a4ba824` to upstream ImmortalWrt commit `a4ba8240d8a1aaef7e8c6f2d65e841a9bfd2b8c5` (Merge Official Source, 2026-11-14T03:42:48Z, confirmed through the GitHub API) and to candidate run `43568494545` of `IRIS-Alpha/H5000M-CI-Qmodem-OP` (dispatch build at `09a2fcfb0`). Recorded in `docs/FIRMWARE_PROVENANCE.md`; the remaining gap is byte-level provenance, since the repository has no releases and the artifacts expired.
- 2026-11-22: Wrote `docs/BUILD_AND_INSTALL.md` so the SDK workaround, the stale-`.pkgdir` trap, the minified payload check, the install commands, the translation collision rule and the takeover gate are repeatable instead of living in this conversation.
- 2026-11-22: Collected read-only kernel-handover evidence (pwm-fan hwmon, cooling levels 0/128/192/255, trips 40/85/115, zone bindings, driver semantics) and found that any userspace `pwm1` writer resets the driver's cached cooling state, which suppresses the kernel's 85/115 °C steps while the governor believes it already acted. Recorded in `docs/KERNEL_HANDOVER.md` with three options; the live handover test and the “above 100 °C the kernel stays in control” wording need a decision before anything is changed on the device.
- 2026-11-22: Header switchers now carry their own 2px padding instead of the generic 9px control padding, and the language glyph drops to 10px, so 中文/EN keep 5px clearance from the button border at 320px.
- 2026-11-22: Both header rows (dashboard and advanced) inset their bordered controls 6px from the card edge, so the switchers and the back link no longer sit on the content border.
- 2026-11-22: The advanced view drops its own back link — LuCI already renders the 仪表盘/高级设置 page tabs — and the dashboard header row gains 6px of top inset so the switcher borders no longer start flush with the content edge.

- 2026-11-22: Block B backend half landed: `fixed_duty` 0–100 in 1% steps, `off` mapped to a zero fixed request as a legacy alias, dead `off:*` branch removed, fixture updated; 33/33 checks pass.

## Completed task block: Block C — kernel fan handover (verified gate)

目标：把“接管内核保护”改成语义正确的“接管风扇控制”，并让接管必须经过核验才生效。只改门禁与文案，本轮不改真机运行行为。

- [x] 记录只读证据：`cooling-levels`、三条 cooling map、`pwm_fan` 驱动写入路径
- [x] 新增 `kernel_takeover_ready_dir`（thermal 目录 + PWM 路径 + 两个开关 + `pwm-fan` 冷却设备）
- [x] 守护进程读取 `takeover_verified`，门禁改用新函数，配置默认 `takeover_verified '0'`
- [x] 高级设置文案改为“接管风扇控制”与全温度区间说明；zh_Hans 同步
- [x] Bats 覆盖门禁真假组合（34/34）
- [x] 重建并安装 APK，确认门禁仍关闭且文案生效（2026-11-22）
- [x] 真机有界交棒实测（2026-11-22，用户批准）：插件接管，`pwm1` 跟随请求；旧服务停用并取消开机自启
- [x] 接管时上调最冷两个 `pwm-fan` 触点（40 °C → 1000、85 °C → 下一触点 − 1000），释放时恢复，并把 `user_space` 残留修回 `step_wise`；Bats 36/36（2026-11-22）

验收：默认配置下真机行为不变；只有在 `takeover_verified=1`、PWM 可写且存在 `pwm-fan` 冷却设备时才真正接管；文档与界面不再表述“100 °C 以上由内核接管风扇”。

## Brief log

- 2026-11-22: 高级设置布尔项改为右对齐开关（44×24，`--sw-on/--sw-off/--sw-thumb` 取主题 token；只读时 45% 透明）；合并“接管风扇控制”与“启用风扇控制”为单一开关，`handleSave()` 同时写 `enabled` 与 `kernel_takeover`，旁边显示交棒核验状态；说明缩短为一句话，避免主题把长帮助折叠成一行再加 ⓘ 与原文重复。新增 po 条目：交棒核验 / 已核验 / 尚未核验。

- 2026-11-22: 高级设置排版审查后重做（A+B）。六个参数组由 `groupCards()` 在渲染后按 `.pwmfan-group-heading` 切分并包进 `section.pf-group`，`.cbi-section-node` 改为网格（窄屏单列 12px 间距，≥992px 两列 16px 间距），`.cbi-section` 去掉主题卡片底色；页面高度 1360px 视口下由 1210px 降到 844px。复选框行的说明改为 `grid-column: 2 / -1`，与标签同列（此前说明左缘 27px、标签 55px）。行内边距 6→8px，标签到控件 6→8px。仪表盘加减按钮改用 CSS 条状符号（`text-indent` 隐藏字形，`::before` 横条 + `.pf-step-plus::after` 竖条），因为 `−` 与 `+` 的墨迹都不在按钮视觉中心。`STRICT=1 sh tools/check.sh` 36/36。

- 2026-11-22: 图表温度单位改为 `°C`（纵轴与横轴刻度都补全单位，量宽按 `100°C` 重新计算，320px 下自动稀疏为 0/40/100°C 三点）；全局字体改为 Vantage 字体栈 `--v-font → --font → 系统栈`，canvas 文本同步换用该栈（原为等宽），并保留 `tabular-nums` 对齐数字。

- 2026-11-22: 光晕改为 9px 内 9px 外，并给出平滑过渡：`box-shadow` 用三层（2px / 5px / 9px）同色不同 alpha 叠成连续衰减，最内层 alpha 与边框一致（暗 0.30 / 亮 0.85），边框本身也参与动画（58% → 95%），因此边框到光晕没有台阶。实测越界量：右 −2px、上 −2px、下 −6px（负值即在卡片边框内），651px 宽时 −6px。

- 2026-11-22: 警示柔边区比例改为外 0.7 / 内 0.3：外阴影 3.5→9px（峰值 8→18px）、内阴影 9.5→4px（峰值 18→8px），alpha 不变；总柔和距离与上一版相同，只是分配比例换了。

- 2026-11-22: 警示光晕改为内外各半：外阴影模糊 7→3.5px（峰值 16→8px）、内阴影 6→9.5px（峰值 10→18px），alpha 提到 0.2 / 0.55，柔边区从边框外向内侧对称铺开；文字辉光不变。实测峰值态外阴影 `0 0 8px 0.5px / .55`、内阴影 `inset 0 0 18px -2px / .55`。

- 2026-11-22: 按“两拍峰值相隔 500ms”重做警示脉冲（用户选 A 口径）。第一拍 0.56 秒暗态 + 0.24 秒增亮到峰值，0.24 秒回落、0.02 秒暗态；第二拍 0.24 秒增亮、0.24 秒回落；其后 1.76 秒静默。周期 3.3 秒（关键帧 0/17/24.2/31.5/32.1/39.4/46.7%）。实测峰值 794ms 与 1291ms，间距 497ms，下一轮峰值 4109ms，亮态采样 18/143。

- 2026-11-22: 警示脉冲改为 0.8 秒淡入 + 0.8 秒对称淡出：淡入窗口前 0.56 秒暗态、最后 0.24 秒增亮；淡出窗口前 0.24 秒回落、后 0.56 秒暗态；两拍之间再空 0.5 秒。周期由 3 秒延长到 3.7 秒（关键帧 0/15.1/21.6/28.1/56.8/71.9/78.4/84.9%）。实测峰值落在 21.5% 与 78.3%（794 ms、2897 ms），亮态采样 16/115、暗态 80/115，动画时长确认为 3700 ms。

- 2026-11-22: 警示脉冲按用户要求拉长暗态、缩短拍间隔：暗态保持 0.8 秒 → 0.12 秒快速增亮 → 0.18 秒回落，两次脉冲之间空 0.5 秒，周期仍 3 秒（关键帧 0/26.7/30.7/36.7/53.3/80/84/90%）。实测峰值落在 30.7% 与 85.1%（0.92 秒、2.55 秒），间隔 1.63 秒 = 0.8 + 0.12 + 0.18 + 0.5，暗态采样占 68/88。

- 2026-11-22: 警示脉冲包络改为“先暗后爆”。每个脉冲窗口 24%（0.72 秒）内：前 14%（0.42 秒，占窗口 58%）维持柔和暗光环，14%→18% 用 0.12 秒快速增亮到 alpha 0.55 / 模糊 16px，18%→24% 用 0.18 秒回落；两次脉冲间隔 0.74 秒，其后静默 2.09 秒（含下一拍的前段暗态），周期仍 3 秒。实测（`getAnimations().currentTime` 对齐）峰值出现在 17.6% 与 42.4%，两次峰值间隔 744 ms，暗态 alpha 0.18 / 模糊 7px 且不再归零，因此保留“柔和边框”观感。

- 2026-11-22: 流光方向与脉冲帧长调整。流光改为水平（`linear-gradient(90deg)`）且 `background-position` 由 100% 走到 -200%，实测采样 100% → 78% → 44% → 9.7%，即光带自左向右移动；警示脉冲的淡入淡出帧长翻倍（12%/26%/38%/52% 关键帧，淡入约 0.36 秒、淡出约 0.42 秒），两次脉冲后静默，周期仍为 3 秒，实测 alpha 序列 0.4 → 0.13 → 0 → 0.19 → 0.45 → 0.35 → 0.06 → 0。

- 2026-11-22: 警示光晕改为淡入淡出。原来用 `box-shadow` 的 0→3px 阶梯，阴影会突然出现/消失；现在按霓虹呼吸的写法，把外发光、内发光与文字发光一起用 `ease-in-out` 在“全透明”与“亮”之间插值，颜色取标签自身的琥珀/红色（暗色主题用 `#ffc26d` / `#ff8a9b` 的 rgb 分量，通过 `--pf-glow` 变量传入）。实测预览与设备上 alpha 依次为 0.035 → 0.435 → 0.13 → 0.45 → 0，两次脉冲后静默，周期 3 秒。

- 2026-11-22: 页头控件与警示节奏修订。明暗/语言交换器改为 32×32 圆角方形（原先被通用 `height: 34px` 拉成 30×34 的长方形），状态徽标同高 32px、圆角 9px，320/390/1360 与设备上三者顶端对齐、等高；警示标签改为心跳节奏（两次约 0.2 秒快闪后静默，周期 3 秒），替换原来的 1.1 秒双闪 + 5.2 秒呼吸。按 `$impeccable` 与 `$web-design-guidelines` 做了一轮 UI/UX 检查：设计检测器原报 3 处 bounce 缓动，已改为 `cubic-bezier(.22, 1, .36, 1)`，现为 0 条；对比度实测亮色 7.62–17.07、暗色 8.13–13.17 全部达标；图表 `canvas` 由 `tabindex=0`（无键盘处理）改为 `role="img"`；补 `-webkit-tap-highlight-color` 与设置输入的数字等宽。资源占用实测：守护进程一分钟消耗 0.75 秒 CPU（1.25% 单核，整机忙碌约 8.8%，折合 0.3%），无 `slow-cycles`，负载 0.25–0.39。

- 2026-11-22: 第二轮界面修订。模式容器改为选中态载体（绿色描边 + `conic-gradient` 流光，标题行去边框），设备与预览均确认动画生效；警示标签加实心圆点与 16% 底色填充，出现时快闪两次后按 5.2 秒周期呼吸；风扇曲线/温度历史/参数面板的展开状态写入 `h5000m-pwmfan-details`，刷新后保持；语言交换器改为 CN/EN 两态（`auto` 时按页面实际语言显示）；绘图区在画布尺寸为 0 或采样不足时显示“无数据 · 请刷新页面”，并按 250 毫秒最多重试 12 次。实测：390/320 明暗主题下无横向溢出，设备上流光动画、CN 标签与折叠持久化均通过。

- 2026-11-22: 修复用户报告的四个界面缺陷。滑块圆点改为页面自绘（原生输入透明、只留交互），实测 320/390/1360 与设备上圆点中线偏移均为 0；警示标签出现时快闪两次（1.1 秒，`prefers-reduced-motion` 下不闪）；曲线图与温度历史首次绘制不再走 `requestAnimationFrame`，标签页重新可见时重绘；提交失败路径改为 `uci revert` + 重新加载配置，设备实测失败后 `uci changes` 为空、界面回到已保存值并弹出一次提示，不再残留三条“未保存”标记。

- 2026-11-22：触点上调已在真机生效并验证。接管启动后 `trip_point_5_temp=1000`、`trip_point_4_temp=114000`、`trip_point_3_temp=115000` 保持，`policy=step_wise`，日志记录 `pinned the low pwm-fan trips for the takeover`；连续 10 分钟 300 次采样（2 秒一次）`pwm1` 恒为 179、`cur_state` 恒为 1、`writes_total` 恒为 2，热区 36.3–40.4 °C，`logread` 不再出现 `pwm 0 ->` 修正；停服务后触点恢复 40000/85000 并删除记录文件，重启后重新上调。Bats 36/36。
- 2026-11-22：定位到停顿的真因是内核 `step_wise` 与插件的往复：40 °C 触点回落时内核写 `pwm1=0`，插件 2 秒读回再写回，用户听到的就是那 1–2 秒停转。日志里 17:21:33、17:22:28 两次 `pwm 0 -> 191` 与用户报告的两次停顿逐秒吻合。排查确认热区三个 cdev 全部指向同一个 `pwm-fan`，没有 CPU 降频冷却设备，所以内核侧唯一独立的保护是 125 °C 临界关机。经用户确认的方案：接管启动时把最冷两个触点改为 1000 与“下一触点 − 1000”（即 40000→1000、85000→114000），115 °C 与 125 °C 保持不动；原值记录在 `$RUNDIR/thermal-takeover`，释放时恢复；启动时顺带把 `user_space` 的 policy 修回 `step_wise`。
- 2026-11-22：占空比类模式改为立即生效，实测设备上 52% → 40% 在一个轮询周期内落到 `pwm1=102`，`reason=mode`，不再出现 `hysteresis_hold`；温度驱动的曲线/目标驱动仍保留回差与降速等待。同轮修掉连续点击的误报与丢点击：提交前比对同值跳过下发、`uci.apply` 遇到 ubus code 5 重试一次、保存期间控件不再禁用（改动进队列）。设备上 4 连点 + / 4 连点 − 结果精确回原位，无报错弹窗。
- 2026-11-22：停顿排查第二轮。用户补充了 17:00–17:06 的停顿时刻，其中 03:33、05:18 的“短暂提速”对应本轮两次安装重启（kick 写 255 再回落），其余多与我这边的点击测试重合。顺带发现写入仍非零：30 秒保活会周期性同值重写，正是要消除的那次 hiccup，已删除保活，改为只比读回值；`set_pwm()` 新增 `PWM_WRITES` 计数并写入状态文件的 `writes_total`，便于用一段稳态窗口验证“零冗余写入”。
- 2026-11-22：停顿排查收尾。写入频率从每分钟 30 次降到约 2 次，用户连续监听未再听到停顿，`/var/run/h5000m-pwmfan/slow-cycles` 无记录；此前观察到的 17 秒循环卡顿未再出现，复发时由该文件定位。遗留观察：占空比类模式下调时仍会被 10 秒降档延迟与 3 °C 回差挡一下（`reason=hysteresis_hold`）。读写两侧都无异常：无第二个写入者、内核 thermal 未降档、`pwm1` 采样恒定、系统负载 0.12、PWM 波形 20 kHz/70.2 % 正常。给守护进程加写入追踪后发现停顿时刻正好有同值重写，于是改为「仅在数值变化时写 PWM，30 秒保活纠偏」，并加慢周期日志（单周期 >5 秒记 `slow-cycles`）。

- 2026-11-22：真机交棒实测通过并落地。基线 51/255、48.7 °C；接管后 `state=running owner=userspace`、`pwm1=179`（安静 70%），64 秒采样恒定、温度回落到 40–41 °C；回滚路径验证：停插件写 255 全速、启旧服务回到 51。旧 `h5000m-fancontrol` 已停用并 `disable`，开机顺序冲突消除。看门狗脚本未在 SSH 断链后存活，改为宿主侧每 2–3 秒采样监控。

- 2026-11-22：内核交棒改为全局接管 + 核验门禁。`kernel_takeover_ready_dir` 要求 `kernel_takeover=1`、`takeover_verified=1`、PWM 可写且存在 `pwm-fan` 冷却设备；守护进程新增 `takeover_verified` 解析，配置默认 0；高级设置文案改为“接管风扇控制”；Bats 34/34。

- 2026-11-22: Re-recorded `docs/UIUX_IMPROVEMENTS_2026-11.md` as the live backlog. The four existing findings stay open for visual acceptance; the new batch covers the one-row header with theme and language switchers, mode-container highlight, the three-row fixed-request block with 1% controls and a floating readout, the conditional warning row, dashboard LuCI actions, and a reusable advanced-settings module style. Noted that `vantage_theme` already owns the theme preference and that deleting `mode=off` would send legacy configs into the full-speed failsafe.
- 2026-11-22: User settled the zero-duty question (1% step, no separate stop action, warning shown), asked for the control source to merge into the running badge, and accepted removing the statistics line; the language control stays three-way until the mobile header is settled. Recorded in `docs/REQUIREMENTS_V3.md` §13/§14/§15 and opened the Block B task block. The apply model and the 3-second interval remain a labelled proposal.
- 2026-11-22: Re-checked project status against the newly added `docs/HANDOFF_V4.md` and `docs/NEW_CHAT_PROMPT_V4.md` (commit `45ebffa`). Code baseline stays `b5aaed7`; HEAD is `45ebffa` because the handoff documents sit on top of it. Preview responses match the worktree byte-for-byte, `STRICT=1 sh tools/check.sh` passes 33/33, and the firmware repository keeps its five pre-existing modifications untouched.
- 2026-11-22: Fixed the four accepted visual findings in the local views: history-axis label thinning, docked advanced command bar, a single advanced heading with theme card tokens, and 3 + 2 preset/drive grouping. Header controls keep equal width and height with a 172px cap. `STRICT=1 sh tools/check.sh` 33/33; no behaviour change.
- 2026-11-22: Recorded the fix evidence in `docs/UIUX_RECHECK_2026-11-22.md` section 7. Zero-duty semantics, apply timing, and the 3-second interval remain open for Block B.
- 2026-11-22: Rechecked the four accepted UI findings and the nine new proposals in the local preview at 320/390/500/651/1360px in light and dark themes. Issues 1.1, 1.2, and 1.4 reproduce; 1.3 reproduces as duplicated page titles while the dark back-button colour did not reproduce. Recorded `docs/UIUX_RECHECK_2026-11-22.md`; no interface or controller code changed.
- 2026-11-22: Removed a duplicated section 14 in `docs/REQUIREMENTS_V3.md`, clarified the finished UI-corrections block heading, and restored the blank line before the queued UI/UX verification block. Documentation only; no interface or controller change.
- 2026-11-22: Logged the four accepted visual findings and the new UI proposals in `docs/UIUX_IMPROVEMENTS_2026-11.md`; scheduled preview rechecks and left apply timing, 0% semantics, and the 3-second interval unresolved. No UI code changed.
- 2026-11-22: Added the three requested project-local UI skills, preserved available upstream license and notice files, pinned the source commits, and documented the design/iteration/final-review stages. Impeccable hooks remain disabled.
- 2026-11-21: User selected Apache-2.0 for the independent package. Added the official license text and declared `PKG_LICENSE`/`PKG_LICENSE_FILES`. Confirmed current delivery remains firmware-integrated with local APK validation; runtime feed and signing setup are deferred until stabilization.

- 2026-11-21: Re-ran `STRICT=1 sh tools/check.sh` (33/33 pass). Host `apk-tools 3.0.5` verified both October-SDK compatibility APK payloads and metadata: main package depends on `libc`/`luci-base`; zh-cn package depends on the main package and contains `h5000m-pwmfan.zh-cn.lmo`. Both signatures are reported untrusted, so neither is eligible for target installation/release verification. The supplied firmware rootfs confirms `r0-a4ba824`, but its source commit was not retrievable from the three candidate upstream repos; the public Releases Atom feed returned no entries and the unauthenticated Actions API was rate-limited. Matching build, trusted signing, device translation/UI verification, and live thermal handover remain open. No router or PWM state was changed.
- 2026-11-21: At the user's request, installed the compatibility main/zh-cn APKs on the live `r0-a4ba824` router using `--allow-untrusted` for local validation. Verified package registration, `.lmo` presence, sensor reads, disabled control state (`enabled=0`, `kernel_takeover=0`, `requested_pwm=--`, `owner=none`), and current PWM readback `51/255`; the existing `h5000m-fancontrol` remained running and this package has no boot enable link or resident process. Browser-language rendering, matching-build validation, trusted release signature, and hardware takeover remain open. No control UCI values were changed.
- 2026-11-21: Confirmed the next UI revision: local WSL workspace is the development/acceptance baseline and router-installed APKs are deployment checks; split fixed PWM requests from curve presets with mutually exclusive title/status indicators; use six ticks for five equal chart intervals, custom minute ranges in 5-minute multiples, custom history sampling fields, consistent fold controls, and a full-width advanced curve-source selector.

- 2026-11-17: Created independent `luci-app-h5000m-pwmfan` workspace and moved the handoff into it; initial commit `757cc30`.
- 2026-11-17: Added ShellCheck/shfmt/Bats/SDK preparation, CI scaffold, and initial requirements/UI drafts. Tool binaries are not installed in the Windows workspace.
- 2026-11-17: User specified one-page operation with dispatch presets, sensor array, curve, protection, language selection, and Vantage styling. Confirmed upstream `anothaDev/luci-theme-vantage`; theme owns light/dark/auto and responsive LuCI styling.
- 2026-11-17: Starting package backend first. Factory package remains reference-only due unknown license; current H5000M community package is the licensed behavior reference. New package will report requested and read-back PWM separately and will not disable CPU thermal protection.
- 2026-11-17: Added the standalone APK Makefile, read-only-by-default UCI config, procd service, PWM controller, curve helper library, and initial Bats tests. High temperature and faults request fixed 255/255; the runtime status records read-back PWM to surface kernel/driver overrides. Git Bash syntax check was blocked by a Windows signal-pipe permission error; CI/Linux validation remains pending.
- 2026-11-17: Added optional fresh 5G telemetry and modem throttle PWM floors; separated user-selected curve temperature from the all-source high-temperature override. Added offline tests for modem floors and control-vs-safety sensor arbitration. User deferred the license decision, so package metadata remains `UNKNOWN`.
- 2026-11-17: Made disabled and kernel modes read-only while still publishing sensor/PWM status; added handover and service-exit status snapshots. Static file scan passed; runtime shell/SDK checks remain blocked by missing Linux tools and the local Git Bash launch error.
- 2026-11-17: Strict WSL checks pass after LuCI integration: ShellCheck, shfmt, 12 Bats tests, Node syntax, msgfmt catalog validation, menu/ACL JSON parsing, and whitespace checks. Visual Playwright replay remains blocked on missing Vantage-required LuCI 25.12 rootfs and recording mirror.
- 2026-11-17: Unpacked the H5000M sysupgrade root SquashFS into a private WSL replay rootfs, recorded a read-only Vantage mirror from the router with the policy filter, and kept the mirror outside the repository. Playwright verified desktop light/dark and 390px mobile layouts; fixed the view's invalid `this.value()` calls and moved the long-form mobile action bar into normal flow to prevent overlap.
- 2026-11-17: Captured the UI revision request in `docs/REQUIREMENTS_IMPROVEMENT.md`: remove duplicated summary cards, define six equal quick modes, make manual mode the editable curve, add a separate kernel protection column, use percentage outputs, and specify translation/package acceptance.
- 2026-11-17: Read the live H5000M fan-control page in read-only mode and matched it to `luci-app-h5000m-fancontrol`; documented its sensor/PWM/thermal/modem inputs, current status fields, the thermal-floor versus applied-PWM inconsistency, and the new rolling temperature/output graph requirements.
- 2026-11-17: Updated the UI requirements to split the default dashboard and Fan policy into Home and Advanced Settings pages; specified matching range/interval/enabled controls below both graphs, grouped advanced behavior by downshift hysteresis/start boost/fault full-speed, and deferred a configurable sensor catalog as a later enhancement. Fan animation is optional and must reflect known state; chart disable must not affect control or safety sampling.
- 2026-11-17: Implemented the revised dashboard and Advanced Settings page, simplified Chinese strings, editable manual curves, output/temperature rolling charts, and percentage-based summaries. Offline Vantage demo replay passed desktop light and 390px mobile dark layout checks; synthetic samples appeared in both charts, curve point editing and advanced save completed without browser errors. Package checks passed before the last UI edits and were rerun for this revision.
- 2026-11-19: Recorded V3 UI requirements in `docs/REQUIREMENTS_V3.md`, superseded conflicting earlier UI decisions, and documented protection/ownership/off semantics plus Vantage reference and source-license questions. Documentation only; no device or functional changes.
- 2026-11-19: Discussed kernel cooling ownership evidence, throughput-style visual reuse, and fixed curve nodes. Recommended read-only thermal mapping first, fixed six-point editing, and separate 0% stop zones from minimum stable running output.
- 2026-11-19: User accepted the proposed kernel ownership and chart-style direction, and accepted fixed-node editing. Documented that control output is piecewise-linear between nodes, with integer PWM quantization and constant endpoint extension.
- 2026-11-19: Compared smart/automatic control in the firmware `h5000m-fancontrol` and this package. Both have temperature-related protection, but neither adds 20 percentage points to curve output: the former combines curve output with kernel cooling and modem floors, while the latter requests 100% at its 85°C safety threshold and uses full-speed failsafes for sensor/config/write faults. Recorded “温度保护” as the temporary feature name; behavior remains open pending a definition.
- 2026-11-19: Extracted the local Hiveton H5000M FDT from the firmware FIT kernel and compared its CPU thermal trips/maps with the supplied table. All six temperatures match and each declares 2°C hysteresis. Recorded the 50/75/100% PWM cooling mappings, separate CPU cooling at 117°C, and the need for runtime ownership confirmation.
- 2026-11-20: Recorded the agreed target-drive/global-protection contract in V3. Next: read-only runtime arbitration evidence; offline controller logic and tests can proceed without changing device thermal ownership.
- 2026-11-20: Read the live fan-control status through LuCI. It reports thermal state 1/3 and floor 128/255 while requested/applied PWM is 51/255 in manual mode; direct sysfs reads are denied and no service-stop test was performed, so ownership remains unresolved.
- 2026-11-20: Added project-level delivery, blocked-work, tracker, decision, device-access, and delegation rules in `AGENTS.md`; marked V3 section 9 as historical discussion superseded by confirmed section 12. Target-drive implementation remains the active task block.
- 2026-11-20: Implemented and tested pure feed-forward/blend interpolation, bounded PI anti-windup, and global protection transition helpers. These are not connected to PWM writes; target-mode output anchors, global ownership arbitration, persisted trigger counters, and device/runtime integration remain in the open task block.
- 2026-11-20: Confirmed target-drive limits: target 80-100°C; response interval minimum 15°C and maximum `T_target` so its onset stays at or above 0°C; transition width 2-10°C (default 5°C), clamped to the available interval. Added tests for the 0°C onset, interval bounds, and automatic width compression.
- 2026-11-20: Added target-drive composition over feed-forward and bounded PI, including explicit integral freeze and anti-windup at final PWM bounds. Strict checks pass with 17 Bats tests; runtime integration remains gated on read-only ownership evidence.
- 2026-11-20: Read-only router SSH audit was attempted with the configured user and host-key acceptance; the router returned `Permission denied (publickey,password)`. Runtime ownership remains blocked. Continued with independent offline global-protection boundary tests; no device writes or service stops were attempted.
- 2026-11-20: Added deterministic coverage for global protection at acceleration onset, threshold lock, exact release hysteresis, lock release while still in the ramp, equal threshold/target, and invalid states/configuration.
- 2026-11-20: Recorded the commit rule for confirmed requirements. The response interval and transition width update is in `5409bd0`.
- 2026-11-20: Verified the target-drive stop zone and PI recovery offline. A 0% feed-forward request stays at 0% before protection is applied. When PI discards an integral update at saturation, the correction is recalculated from the retained state. The strict suite passed all 18 tests.
- 2026-11-20: Verified offline dispatch from 0% through protection boost, ramp, lock, exact release, and relock. Invalid sensor readings or control inputs request full speed without recording a temperature event. The step returns one cumulative count, with history and persistence tracked separately.
- 2026-11-20: Simulated equal target and protection thresholds across lock, release, return to mode control, and the first active PI sample. The test supplies the freeze signal explicitly. The checks passed with 22 Bats tests.
- 2026-11-20: Verified protection history calculations offline. The rolling 24-hour window excludes events exactly 24 hours old. The newest completed or active cycle remains available for the latest trigger and peak display after it expires from the window. Strict checks passed with 24 Bats tests.
- 2026-11-20: Restored WSL SSH with a dedicated ED25519 key for `192.168.10.1`. Verified `ssh -o BatchMode=yes root@192.168.10.1 true` returns 0. The local SSH config selects this key for the router. Host-key verification and existing router login methods were retained.
- 2026-11-20: With `h5000m-fancontrol` running on kernel 6.18.60, observed CPU `step_wise` enabled, trips 40/85/115/117°C active, 120°C hot, and 125°C critical, with 2°C hysteresis. Live fan bindings cover 40/85/115°C and the device tree declares PWM levels 0/128/192/255. Around 48°C, sysfs showed fan state 0/3 and PWM 51/255 across three samples. The installed status helper reported its own derived state 1/3 and floor 128/255, with both requested and applied PWM at 51/255. Its code derives the floor from temperature and cooling maps, so the report does not identify a live kernel request. Kernel-only behavior remains pending. No PWM, governor, cooling-map, or service changes were made.
- 2026-11-20: Recorded the recovery procedure and paused the existing fan service for a 12-second sample window. With the old process absent, PWM was 51/255 and cooling state 0/3 in all seven samples at 48.573–49.985°C. The service resumed with a fresh status timestamp and identical config digest. The sample did not cross a trip. Kernel takeover at a new trip and live integration remain open.
- 2026-11-20: The offline target-drive cycle now derives PI freeze from the current protection state, including the ramp following unlock. The first sample outside protection uses its own elapsed interval. Fault cases keep the retained integral and request full speed. The strict suite passed all 26 Bats tests.
- 2026-11-20: Checked upstream Linux v6.18.60 `pwm-fan` source. Successful userspace writes also recalculate `cur_state` from the configured levels. Recorded why `cur_state=0` and `pwm1=51` alone cannot identify the request source.
- 2026-11-20: The field handoff traced the 20% baseline to a temporary manual request of 51/255 and a local edit to the installed thermal-floor condition while the fan awaits replacement. Corrected the runtime evidence notes and kept device arbitration pending. Offline control verification can continue.
- 2026-11-20: Implemented protection history snapshots in the runtime directory and connected the read-only LuCI status command. Verified restoration after daemon restart within one boot, 24-hour expiry, unavailable history reporting, and preservation of the previous snapshot when updates fail. Strict checks passed all 30 Bats tests.
- 2026-11-20: Rendered the V3 LuCI dashboard and advanced settings with Vantage firmware assets and isolated RPC data. Verified six modes, target validation, manual curve editing, history refill and folding, language selection, and advanced-setting persistence in Playwright. Strict checks passed with 33 Bats tests. The production takeover gate remains closed pending runtime verification.
- 2026-11-20: Restored the V3 preview at port 8028 after the single-threaded server stopped answering requests. The replacement runs as a WSL user service and handles connections independently with a timeout. Verified both routes respond while another request is incomplete and confirmed the Advanced Settings view renders in the browser.
- 2026-11-20: Reviewed the open delivery items. V3 preview and isolated controller checks are complete. Matching firmware package format and build inputs, installed-package checks, and hardware handover remain open. Restored the preview through a hidden Windows WSL process after the transient user service stopped on WSL exit. Both dashboard and advanced routes returned HTTP 200 from Windows.
- 2026-11-21: Added the OpenWrt package-discovery signature after SDK scanning showed the standalone package was omitted. Built the main H5000M fan-control APK and zh-cn translation APK with the official ImmortalWrt mediatek/filogic SDK (base revision e695009c, LuCI feed ebc4118b); extracted both with the SDK apk tool and confirmed the controller/UI payload and zh-cn LMO. This is a compatibility build only: SDK dependencies were skipped after the reduced SDK lucihttp Lua target failed on missing lua.h, and its October LuCI/kernel baseline does not match firmware r0-a4ba824 / LuCI ad75cde. Unsigned/untrusted APKs were extracted for structural verification only. Exact matching build, signed installation and runtime verification remain open.
- 2026-11-22: Added a WSL-native V4 handoff and new-chat resume prompt. Confirmed `/home/devcc/Projects/h5000m-pwmfan` as the canonical package workspace; the Windows package checkout is stale documentation history. Recorded the separate main firmware checkout and its pre-existing dirty state so future work preserves it. No product code changed.
- 2026-11-22: Rebuilt the dashboard header and fixed request per the confirmed proposal: one row with `风扇控制`, the merged `运行中 · 插件控制` badge and single-block theme/language switchers; `模式选择` replaces `快速调度`; the fixed request is three rows (state slot, 1% slider 0–100 with − / + and a floating readout, warning chips over a smaller slogan behind a divider); modes and the slider share one 3-second trailing merge with an `应用中 N 秒` countdown and a 0% bypass; the statistics and control-source lines are gone. Theme switching works without Vantage and only mirrors `vantage_theme.appearance` when that config exists. Verified with `STRICT=1 sh tools/check.sh` 33/33 and preview measurements at five widths in both themes.
- 2026-11-22: 删除“交棒核验”状态行，未核验原因并入开关说明；“故障响应”不再作为表单行（整句并入副标题）；“加速半径”更名“提前区间”。
- 2026-11-22: 开关行标题行高对齐 24px 轨道；输出项标签补百分号；故障响应压缩为一句；曲线温度来源改为运行时传感器列表（带读数与“无读数”、重名追加标签），控制器新增按标签匹配（Bats 37 项）。
- 2026-11-22: 高级设置修 880px 错位（<992px 强制堆叠、≥992px 标签列 0.46fr）与下拉字号（列表项 13px、隐藏空占位）；设备 651/880/1360 复核。
- 2026-11-22: 数值单位移到输入框右侧（6px 间距、垂直居中），标签只留名称；顺带修掉样式数组里因多余 `+` 产生的 `NaN` 选择器（曾使开关颜色令牌整条失效）。
- 2026-11-22: 数值右对齐、单位放进 30px 固定宽度透明容器左对齐，320/880/1360 实测单位左边界一致（254 / 392 / 623 与 1201），无溢出。
- 2026-11-22: 时间单位统一简写（s/ms），下拉行补空单位容器；11 行控件宽度一致（880px 下均为 424px，无溢出）。
- 2026-11-22: 读数区改为报表卡片（名称/数值一行 + 6px 进度条），右上角自定义勾选并持久化，移除转速行；正文换 MiSans 子集（34 分片 148KB，Apache-2.0），曲线数字仍用主题字体；故障响应与传感器说明改写，传感器说明就地挂到“曲线温度来源”。
- 2026-11-22: “曲线温度来源”的说明改为整行标题下方的段落（跨两列、78ch 上限），不再挤在字段列里。
- 2026-11-22: “风扇最低输出”更名“非零请求下限”，并加一行整行说明（0% 停转例外、抬高下限帮助老化积灰风扇维持转动）；`min_pwm` 机制保留，仍作为目标驱动闭环与保护斜坡的下界。
- 2026-11-22: 状态新增 `floor_pwm`/`floor_limited`（非零请求被抬到下限或目标模式停在下界时为 1）；“模式选择”后加静态琥珀芯片“非零请求下限”；保护输出图例在未生效时降到 42%；Bats 覆盖被抬高、0% 停转、达到下限三种情形。
- 2026-11-22: “曲线最高输出”改名“曲线输出上限”并补噪音说明；状态芯片去掉圆点（87px，310px 两行、390px 单行）；高级设置页用“状态徽标 + 主题/语言切换”替换重复的 h2，主题状态写入 `vantage_theme` 供两页与主题共用。
- 2026-11-23: 修好高级设置三处（头部按钮样式作用域误伤接管开关、头部按钮去立体阴影、主题折叠说明被截断导致 `max-height:none` + 去掉 mask 淡出）；曲线模式切换自动展开参数面板；保护等级改为图例常驻“保护输出 · N%”；检查 37/37。
- 2026-11-23: 保护标记改为温度轴上的垂直虚线（锚定 `protection_temp`），图例去掉数值；目标驱动/自定义曲线参数面板移到风扇曲线卡片内、图表下方，切换模式自动展开；检查 37/37。
- 2026-11-23: 目标驱动按钮改为“撤销 / 应用目标”并右对齐；仪表盘的历史窗口与间隔移入高级设置“视图”分组（新增 `history_range`/`history_interval` 配置项），仪表盘改为只读 uci，保存逻辑仍是一页一条。
- 2026-11-23: 修正目标驱动下 `requested_pwm=0` 时 `floor_limited` 误报为 1（0 是显式停转，下限不参与），设备复测 0/0。
- 2026-11-23: 修保存后退出接管与开关样式错乱：开关改名 `pf-toggle`、两个键由 `takeover.write()` 一起写、装饰改为幂等并由 `MutationObserver` 补装饰；`reload` 改为原地重读配置（PID 不变、无 `pwm -> 255` 回退）。
- 2026-11-23: 删除仪表盘“实时读数”卡片，数值并入风扇曲线与温度历史的图例（当前温度取最高有效传感器）；高级设置页头按钮补 1px 边框，消除主题未覆盖导致的 `2px outset` 立体样式。
- 2026-11-23: 图例改成对齐小表——11×11 方块色标、名称居左、数值居右、同行等宽（2/4 列）；顺序改为曲线请求/实际输出/当前温度/温度保护，“保护输出”改为显示保护阈值的温度。
- 2026-11-23: 图例列宽由等分改为固定 112px（列间距 30px），修掉大宽屏下“数值与下一项像一体”的错觉；窄屏 254px 仍在 266px 内容宽内。
- 2026-11-23: 图例几何改为字符制（色标 1、文字 4、间隔≥2、数值+单位 5.5、项间 4 字符；窄屏压缩到 10.2/2），数值一律右对齐，图例内百分比写作“20 %”。
- 2026-11-23: 图例固定双列并整体右对齐（不再有四列布局），宽屏每项 12.5 字符、项间 4 字符。
- 2026-11-23: 修好刷新丢失温度监控历史（新增无参 `/usr/sbin/h5000m-pwmfan-history` + ACL exec 权限，因为本固件 `fs.exec` 带参数一律“不支持”、`fs.read /var/run` 无权限）；高级设置回到单列、控件 36px、小字统一 12px/18px 且移到行下方；视图分组拆成风扇曲线设置/温度监控设置；“温度历史”改名“温度监控”；状态芯片与警示芯片同几何并在 <380px 时下放且靠右；图例百分比改用两个不换行空格。
- 2026-11-23: 状态芯片复用警示芯片的柔光与脉冲；头部改为自然折行（320px 需 271px、内容宽 266px → 芯片换行靠右，360px 起单行）；字体回退到系统默认栈并删除 MiSans 子集；开关与输入框左对齐（390/1200 实测同 x）；口号改为“温度过高…”。
- 2026-11-23: 去掉警示芯片的前置圆点（省 12px），320px 头部因此从两行回到单行（255 ≤ 266）。
- 2026-11-23: 芯片组改为整体右对齐（`.pf-head-right`，测 320/390/1200 组右缘与卡片右缘一致）；副标题恢复上下分隔线。
- 2026-11-23: 修“曲线温度来源全部显示无读数”（误把 state=unselected 当成无值）；读数每 5 秒刷新；下拉行统一 32px 并隐藏占位与自定义输入行。
- 2026-11-23: 历史读取改为设备端裁剪（按 `history_range` 只输出窗口内的行，15 分钟 424 行 / 12.7KB），读取失败时在图中央显示原因并写入 `canvas.dataset`；预览补上 history helper 的桩。
- 2026-11-23: UI/UX 修复 P0（reduce 漏项、浅色芯片对比度、图例自适应、空状态文案、死代码）与 P1 的 6/7/9/10（h2 层级、inputmode、图表标题、下拉刷新节流）落地；P1-8 与 P2/P3 未开工。
- 2026-11-23: 英文图例改为按内容等宽两列（空隙 1em/2em，窄屏单列）；「保存并应用」改走 `ui.changes.apply`，消除残留的未保存提示；保存条加载圈补 `align-items:center` 并给动作条加 `.pf-actions`。
- 2026-11-23: 仪表盘保存条（延迟倒计时 + 立即应用）落地；横轴刻度在窄屏倾斜 45°，320px 下六条刻度完整。
- 2026-11-23: 降速保持只对温度下降生效，换预设立即降速；曲线温度来源改为原生 select；图例恢复整块右对齐。
- 2026-11-23: 保存条改为两页同构的贴底浮动条（高级页带未保存计数与离开守卫，仪表盘排队时才出现）；轮询在页面隐藏时暂停、回前台补刷，画布无变化不重绘；两张图补视觉隐藏的数据表供读屏。
- 2026-11-23: 曲线输出上限改为 40–100 %，并补双向校验（下限 ≤ 上限，表单与守护进程各一层）；曲线取值超出上下限改为运行时钳制，不再整份拒绝。默认值调整：温度回差 3→2 °C、解除回差 5→3 °C、降速等待 10→5 s、启动助推输出 100→80 %、启动助推时长 750→800 ms、监控窗口 15→5 分钟（配置、守护进程回退值、helper 与两个视图同步）。
- 2026-11-23: 上下限越界改为钳制：上限钳进 40–100 %、下限钳进 0–100 %，两者冲突时把上限抬到下限；只有非数字值仍判为无效配置。测试同步为钳制断言（76→102、400→255、204/153→上限 204、非数字仍拒收）。
- 2026-11-23: 固定请求模式不再受 `drive` 影响（`fixed:*`），避免残留 `drive=curve` 触发 `invalid_control` 全速；设备实测 128/255 正常、`state=running`。
- 2026-11-23: 按评审意见修正——图表“曲线请求”改用 `mode_pwm`（与实际输出区分），历史窗口兜底改 5 分钟，交叉校验去掉魔法默认值，钳制结果写日志，补两条回归用例。
- 2026-11-23: 控制周期区间由 1–30 秒收窄到 1–10 秒（默认 2），守护进程改为钳制；理由是它同时决定温度历史分辨率与保护斜坡的可采样性。
- 2026-11-23: 控制周期区间由 1–10 秒进一步收到 1–5 秒（默认 2）；依据是旧插件 `h5000m-fancontrol` 的 `interval` 默认 5 秒、下限 2 秒（代码与本机旧 uci 一致），60 秒上限从未被合理使用。

## Completed: unattended cleanup (2026-11-23)

Constraints for this block: only work that needs no human decision. The router is read-only (no `uci set`, no PWM or
thermal-zone writes). Every item ends with `STRICT=1 sh tools/check.sh`, a look at the preview, and its own commit. A
question that needs a person goes to "Awaiting decision" instead of being guessed.

- [x] A. Safety net: record the current device state (`uci export`, package list, `/var/run/h5000m-pwmfan/status`, APK
      hash) in `docs/device-baseline-20261123.md` so later changes can be diffed and rolled back.
- [x] B. Rebuild the preview regression test: `tests/preview.mjs` still asserts `.pf-metric`, `.pf-modes`,
      `.pf-danger` and `.pf-method-title`, none of which exist after the report-card removal and the layout rework. Rewrite
      it against the current DOM (legend, chips, dropdown, both canvases, responsive matrix, three themes) and make sure it
      runs.
- [x] C. i18n gaps: `_('Select Custom curve to edit the six curve points.')` and `_('Except for an explicit 0% stop
      request, no request drives the fan below this value. A higher floor keeps an aging or dusty fan turning at low
      duty.')` were reported as untranslated. The first was really missing; the second was already in the catalogue and the
      report was a multi-line-msgid artefact. Add the missing one and a `check.sh` guard that fails when a
      `_('…')` in the views has no msgid.
- [x] D. Dead CSS: `.pf-danger` and `.pf-segment` are no longer referenced by any view; remove and confirm the bundle size
      and the preview.
- [x] E. bats coverage: `in_range`, `is_signed_int` and `is_uint` have no direct cases.
- [x] F. Responsive × theme matrix: 320/360/390/430/651/736/880/992/1200/1360 × light/dark, with assertions (no
      horizontal overflow, chips never overlap, legend columns aligned, both canvases painted), and fix what it finds.
- [x] G. Web Interface Guidelines review on the four interface files, per `AGENTS.md`; fix the applicable findings
      (visible focus, ARIA, contrast, reduced motion, tap targets). Result in
      `docs/design-review-20261123.md`. Four fixes: the chart canvas is now a tab stop (its key handler was
      unreachable), the preset buttons got a hover state, `touch-action: manipulation` now covers every control, and
      card headings balance their wrap. Two reported findings were retracted after measuring: the legend already
      truncates correctly, and the advanced page's native `<select>` inherits the theme colours in both schemes.
- [x] H. Docs-versus-code sweep: grep `docs/*.md` for hard-coded constants, function names and behaviour claims; the
      `kernel_takeover_ready() { return 1; }` find shows how far a paragraph can drift. Result: eleven bullets in
      `docs/REQUIREMENTS_V3.md` still described designs that no longer exist (the readings card with its “自定义” picker
      and `pwmfan-report` key, the MiSans subset, the legend without values, the 42% dimmed protection key, the
      `minmax(…, max-content)` legend columns, the five-minute-multiple window, the old panel names, the old preset
      names and the legend order actual-before-temperature). They now match the code, and the theme path no longer
      claims to live in this repository. The sweep also found one dead rule, `.pf-legend span.is-off` — removed.

### Decided by the user (2026-11-23, round 117)

- The fan curve card opens expanded by default, like the temperature monitor. Both cards remember a collapse only, so a
  card the user reopens stays open on the next visit (`detailState()` in
  `htdocs/luci-static/resources/view/h5000m-pwmfan.js` reads `h5000m-pwmfan-details` for `false` and ignores `true`).
- The monitor chart's tilted time axis on phones stays as it is.
- Curve editing stays pointer-only, with the limitation documented in `docs/design-review-20261123.md`.

Brief log: 2026-11-23 — H closed. Sweep method: extract every backticked token from `docs/*.md`, then check paths
against the tree, `name()` against the shell/JS corpus, CSS selectors against the stylesheet, and `key=value` against
the config and views. Every remaining hit was a dated snapshot, a line-suffixed path (`file.js:470`) or an upstream
kernel symbol (`KERNEL_HANDOVER.md` quotes `drivers/hwmon/pwm-fan.c`), so they stay as historical evidence.

Brief log: 2026-11-23 — G closed. The canvas had a `keydown` handler since the cursor was added, but no
`tabindex`, so keyboard focus never reached it; `ArrowRight`/`ArrowLeft`/`Escape` now move and clear the read cursor
(painted pixels 63387 → 63542 → 63488 → 63386). The preset buttons changed border colour on hover only after
`[aria-pressed=true]`; the idle → hover transition is `rgb(214, 218, 222)` → `rgb(74, 81, 90)`. `touch-action:
manipulation` reached two control classes and now reaches all of them. `tests/preview.mjs` also gained the right
default URL (the dashboard page), because the old default 404'd and the run timed out on `.pf-page`.

All eight items closed without touching the router. What the pass changed: a preview regression test that actually
covers the current DOM (and fails when the drawing breaks), an i18n guard in `tools/check.sh`, a catalogue cut from
245 to 123 live strings, direct bats cases for the three numeric predicates, a real high-DPR drawing bug fixed, a
keyboard-reachable chart, and eleven requirement bullets that had drifted away from the shipped interface. Nothing has
been installed on the device: the three UI commits (`60848ee`, `6a4a723`, `a410450`) are in the working tree for the
next round that is allowed to deploy.

Not in scope (needs a person): the five externally blocked items, any change to live device behaviour, signing and feed
decisions.

## Done: shell daemon micro-optimisations (2026-11-23)

Measured baseline on 192.168.10.1 (4x Cortex-A73, `poll_interval=2`): one daemon cycle costs
**137 ms of CPU** (27.5 ms in the shell itself, 109.5 ms in child processes), i.e. 6.8 % of one
core. About 29 fork/exec per cycle. These four changes are parked; each keeps behaviour identical
and is verified with the same gate (`sh -n`, `shellcheck`, `shfmt`, 37 bats cases, `STRICT=1 tools/check.sh`).

1. `$(cat file)` -> `read -r x <file` for sensor values, the PWM readback and hwmon names (~12 forks).
   Risk: `read` strips leading/trailing IFS whitespace, so names that may contain spaces stay in awk.
2. Cache the fan path and the hwmon/thermal names at startup instead of rescanning every cycle
   (~13 forks; entry `find_fan()` re-runs only after a failed PWM write).
3. One `awk` pass over `/sys/class/hwmon/hwmon*/*_input` and `/sys/class/thermal/thermal_zone*/temp`
   instead of nine `cat` calls (~7 forks; keeps the existing `valid_temp_mc` checks in shell).
4. Reuse a single `date +%s` per cycle (status stamp, modem age) and time the cycle from
   `/proc/uptime` instead of two extra `date` calls (~4 forks).

- 2026-11-23: 监控间隔改为 1…5 秒并同时驱动刷新（实测 `history_interval=1` 下 10 秒 10 次历史读取、5 次状态读取）；状态轮询跟随 `poll_interval`；画布仅在数据变化时重绘、且尺寸不变不再重设 `canvas.width`（消除空白帧）；历史文件保留两倍窗口，helper 改单遍 awk。

Expected: ~29 -> ~4 forks, 137 -> ~40 ms per cycle (2 % of one core). Re-measure with the same
`/proc/<pid>/stat` window method before and after; `sleep` costs only 1.5 ms per cycle and is not
worth changing.

Implemented 2026-11-23 (items 1, 2 and 4; item 3 became redundant because `read` is a builtin, so the
nine `cat` calls are gone without an awk pass):

- `read -r` now reads the PWM readback, PWM name, thermal zone type and hwmon name; `${x//...}`
  label sanitising was replaced by a `case` guard so the `tr` fork only happens for a name that
  actually contains a separator (dash rejects `*[|;=]*)`, hence the quoted-character patterns).
- The fan path is cached and rescanned only when the cached path stops being writable.
- One `epoch_now` per cycle feeds the status stamp and the modem cache age; the cycle length comes
  from `/proc/uptime`. `H5000M_EPOCH` pins time in tests.
- Measured after the change (same window method, `poll_interval=2`, 40 s = 20 cycles):
  **58.5 ms per cycle** (19 ms shell + 39.5 ms children), about **2.9 % of one core**; was 137 ms
  (6.8 %).

- 2026-11-23: 温度宽限：单次无效读数沿用上一有效值两个控制周期（`STALE_LIMIT = poll_interval * 2`），并在状态里写 `stale_temperature=1`，仪表盘显示「温度过期」芯片；超过宽限仍走 `failsafe no_valid_temperature`。bats 用例用 `H5000M_EPOCH` 钉住三个时刻（宽限内沿用、宽限后全速）。

- 2026-11-23: 任务跟踪核对（第 107 轮后）：Block B / Block C 的全部条目已勾完，标题由 “Active” 改为 “Completed”；3 秒合并器条目复核后勾选（`MERGE_DELAY=3000`、标题行倒计时、0% 立即提交）。仍未勾选的六项都属于“需要真机或官方工具链才能收尾”的前置项：自然触点交棒验证、真机 PWM/热区改动前的评审与回滚流程、匹配 OWT2510 的 SDK 构建与签名、硬件验证与回滚、可选的热区补丁、以及是否上架 feed 的决策。

- 2026-11-23: 低风险清理。删除 `h5000m-pwmfan.js` 里 `REPORT_KEY`（读数卡片下线后遗留的死常量，全仓无引用），部署包从 42,999 字节降到 42,968。卸载设备上的旧包 `luci-app-h5000m-fancontrol-2.1.3-r1`：卸载前把 `/usr/sbin/h5000m-fancontrol`、status helper、init 脚本、menu/acl json、`h5000m/fancontrol.js`、`/etc/config/h5000m_fancontrol` 与旧 i18n 目录打成 `/root/h5000m-backup/legacy-fancontrol-20261123.tgz`（16,201 B，md5 `09ba65f4c580663e0585250a7dd5d087`，工作区另存一份），因为快照 feed 不可达、卸载无法用 `apk add` 回滚。卸载后 menu.d 只剩 netmode 与 pwmfan，旧页面文件消失，`/etc/config/h5000m_fancontrol` 作为 conffile 保留；本插件 `.lmo` 11,456 B、`state=running`、`effective_pwm=51` 未受影响。
- 2026-11-23: 修正 `docs/BUILD_AND_INSTALL.md` 的过期段落：原文还写着 `kernel_takeover_ready() { return 1; }`（“装了也不会接管”），实际门禁早已是 `kernel_takeover_ready_dir`，要求 `enabled=1` + `kernel_takeover=1` + `takeover_verified=1` + 可写 `pwm1` + `pwm-fan` 冷却设备，并列出 `takeover_pending` / `not_enabled` / `released` 三种释放原因；同时补“旧控制器”一节记录备份位置与手工恢复方式。

- 2026-11-23: 预览回归测试重写。旧的 `tests/preview.mjs` 还在断言 `.pf-metric`（读数卡片已下线）、`.pf-modes`、`.pf-danger`、`.pf-method-title` 与 `#theme` 下拉，整套 harness 早已跑不通。新版按当前 DOM 覆盖：五个驱动方式、两个带 `aria-label` 的画布、曲线图例四项（键序 request/temperature/actual/protection、数值与列右缘对齐、列宽相等、元素确实有宽度）、下限与温度过期芯片默认隐藏、固定请求滑块与倒计时保存条、主题按钮三态循环、状态快照改写（`state=disabled` → 未接管，追加 `stale_temperature=1` → 芯片点亮）、10 档宽度 × 3 主题矩阵（无横向溢出、芯片在卡片内且不重叠、图例列对齐、头部不塌）、高级设置七张行为卡片与保存往返。
- 2026-11-23: 负向验证过这套测试确实会失败：把 `.pf-legend span[data-key]` 隐藏 → “legend items are painted 0/0/0/0”；给条目加 `padding-right:3px` → 四条 “value flush right … 972 vs 975”。两个变异都在验证后 `git checkout --` 还原。
- 2026-11-23: 两条 harness 事实：预览的静态资源从仓库 `htdocs/` 出，不是 rootfs 副本（所以预览永远反映工作区，改 rootfs 里的 css 无效）；预览没有 `cgi-exec` 与 `uci/apply_rollback`，传感器字段在预览里是原生 `<select>`、设备上是主题的 `.cbi-dropdown`，测试两种形态都接受。`tools/check.sh` 只在设置了 `PWMFAN_PREVIEW_URL` 时才跑浏览器一遍，并且新增 `node --check` 覆盖 shared 视图与测试文件本身。

- 2026-11-23: 新增 `tools/check-i18n.mjs` 作为目录守卫：解析 po（含多行 msgid 的续行拼接），扫描三个视图里的 `_('…')` 字面量（含 `'a' + 'b'` 拼接形式），缺译文或译文为空即失败，并列出没有代码引用的目录条目。接进 `tools/check.sh` 的 node 段。首跑抓到一处真缺口：`h5000m-pwmfan.js:606` 的 `Select Custom curve to edit the six curve points.` 没有中文，补为“选择「自定义曲线」后可编辑六个曲线点。”；同一个守卫也证明先前以为缺的“非零请求下限”说明其实已经在目录里（多行 msgid 被粗略 grep 误判）。

- 2026-11-23: 目录瘦身。守卫列出 146 条没有任何视图引用的 msgid（旧读数卡片、旧“交棒核验”行、旧分组标题、旧单位写法等），全部删除；`po` 从 245 条降到 123 条，`msgfmt --check` 通过，守卫复跑无缺口。删除前后用 `tools/snap-text.mjs` 抓两个页面在 390px 下的全部可见文本做对比，除演示数据的时间与温度跳动外**逐行一致**，证明删的确实是死条目。
- 2026-11-23: 删除死样式：`.pf-page .pf-danger`、`.pf-page .pf-danger[aria-pressed=true]` 两条规则，以及 `.pf-segment` 与 `.pf-editor-actions` 共用选择器里的 `.pf-segment`（后者保留）。全仓再无 `pf-danger` / `pf-segment` 引用。

- 2026-11-23: 补齐三个从前没有直接用例的谓词（`tests/controller-lib.bats` 现在 40 项）：`is_uint` 收 `0/007/51/999999`、拒 `''/-/+1/-1/1.0/' 1'/'1 '/12a/a12/0x10`；`is_signed_int` 收 `0/-1/-85000/0007`、拒 `''/-/--1/1-/+5/-1.5/' -1'/'1 '/-a`；`in_range` 覆盖边界命中（0、255）、越界（256、5<10）、负数与 **非数字/空上界要“静默失败”**（`[ -z "$output" ]`，因为 `in_range` 里的 `2>/dev/null` 就是为此存在）。循环里的断言写成 `if ! fn; then …; return 1; fi`，而不是 `run` 后接 `|| printf`——后者只打印不失败，等于没断言。

- 2026-11-23: 响应式 × 主题矩阵（40 组合：10 档宽度 × 明暗，两个页面）：横向溢出全部为 0，芯片全部落在卡片内，图例列宽一致，卡片标题不再被截断。矩阵顺带抓到两个真问题：
  - **高 DPR 下图表会变空**（手机常见 2–3 倍像素比）：第 106 轮为了让重复刷新不重画，改成“尺寸没变就不给 `canvas.width` 赋值”，可这个赋值同时是**画布变换的重置**。于是每次重绘都再 `ctx.scale(scale, scale)` 一次，DPR 3 上叠加三次后整幅图被推到画布外——实测温度监控画布 `painted=0` 且此后一直为 0。改成 `setTransform(1,0,0,1,0,0)` → `clearRect(0,0,canvas.width,canvas.height)` → `setTransform(scale,0,0,scale,0,0)`，DPR 1/2/3 着色像素数回到 5686 / 17206 / 37436，`tests/preview.mjs` 新增一条高 DPR 断言（回退修复时它会报 `[["history",0]]`）。
  - **卡片标题的可点击高度只有 23px**（`<summary>`），低于 24px 的最小触控目标；`min-height: 32px` 后矩阵里不再出现小目标。
- 2026-11-23: 两个“看着不对但不能替用户拍板”的问题写进 `Awaiting decision`（曲线卡片默认收起、手机上的斜排时间轴）。

- 2026-11-24: Rollback runbook started: `docs/ROLLBACK.md` now defines five levels (release control, unpin the trips by hand, uninstall, restore the legacy controller, reboot), the exact trip values to write back, abort criteria for a live test, and what a rollback does not restore. `tools/device-snapshot.sh` captures the device read-only and is now in `tools/check.sh`; verified against the router (uptime 382199 s, pid 6735, `v1 5 40000 4 85000`).

- 2026-11-24: L1 观察（用户放行）：释放接管后 `pwm1` 立刻被写成 255、`cooling_device0/cur_state` 被驱动到 3、内核触点回到 85000/40000，但 60 秒内 `pwm1` 始终 255；第二次释放后手动写 51，`pwm1` 保持 51 达 20 秒且 `cur_state` 被驱回 0——即**内核会唤醒热区，但不接管占空比**。`docs/RUNTIME_EVIDENCE.md` 新增 “Release and handover”，`docs/ROLLBACK.md` 的语义与中止判据按实测改正，两个探针 `tools/l1-release.sh` / `tools/l1-poke.sh` 进 `check.sh`。

- 2026-11-24: 进程监督（第 119 轮）。原因是上面那条实测：控制器挂死时风扇停在最后一次占空比，procd 的 respawn 只覆盖退出。新增独立实例 `root/usr/sbin/h5000m-pwmfan-watchdog`（自包含，不 source 控制器库）：心跳 `watchdog-alive`、控制器侧 `watch_watchdog()` 在心跳沉默 20 s 时杀掉它、看门狗侧在 `updated_at` 超过 `poll_interval × 3 + 3` 时写 `pwm1=255` → 恢复内核触点 → `SIGTERM` 控制器让 procd 重建，然后退避 30 s。**只做全速与重启进程，不重跑曲线逻辑**——重建后的控制器会重新钉触点并继续出曲线。硬重启兜底 `watchdog_reboot_temp`（默认 0 关闭）：高于该值持续 30 秒（用 `watchdog-hot` 文件计时，重启看门狗不丢表）且风扇已全速时 `/sbin/reboot`。init 脚本改成两个命名实例（`daemon` / `watchdog`），`reload_service()` 只给 `daemon` 发 HUP。`tests/watchdog.bats` 六项（fresh / stale / 无状态文件 / 外来 pid / 重启关闭 / 重启需保持时间）全过，bats 共 46 项。

- 2026-11-24: 双向监督在真机验证（`kill -STOP` 模拟挂死，procd 看不见这种状态）。控制器停住：第 12 秒看门狗写 `pwm1=255` 并把触点恢复到 85000/40000，第 15 秒控制器被 `SIGKILL`，第 21 秒新控制器（pid 2740）重新钉回 114000/1000 并恢复曲线输出。看门狗停住：第 20 秒控制器发 `SIGTERM`、第 25 秒升级 `SIGKILL`、第 35 秒 procd 重建（pid 2240）。两条只在模拟挂死时才暴露的事实：停住的进程收不到 TERM，必须补 KILL；procd 默认崩溃 5 次后放弃，两个实例都改成 `respawn 3600 5 0`。
