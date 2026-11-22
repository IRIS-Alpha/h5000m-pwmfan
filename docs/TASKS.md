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

- [x] 占空比类模式立即生效：把回差保持与降速等待限定在温度驱动请求上（`hold_down_allowed()`），固定请求与 `drive=duty` 的预设改多少立刻下发。
- [x] 连续点击的误报：同值提交连带跳过 `save`/`apply`，`uci.apply` 遇 ubus code 5 自动重试一次，提交期间控件不再禁用而是进队列。
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
- [ ] Confirm the kernel request on a natural trip crossing after fan replacement and stock controller baseline verification. High-temperature handover remains unverified.
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
- [ ] Gate live PWM/thermal integration on reviewed runtime evidence and a device rollback procedure.
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
- [ ] Hardware validation and rollback procedure.

## Deferred until the plugin is stable

- [ ] Decide whether to submit to an official feed or maintain a self-hosted APK repository; add index signing and device trust only if standalone package updates are still desired.

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

## Active task block: Block B — control semantics and status consolidation

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
- [ ] 固定请求滑块与模式切换共用 3 秒尾随合并器：拖动只更新读数、松手才提交、0% 绕过合并立即提交、标题行显示“应用中-Ns”；不做后端步进限幅（已定案，见 `REQUIREMENTS_V3.md` §16）。

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

## Active task block: Block C — kernel fan handover (verified gate)

目标：把“接管内核保护”改成语义正确的“接管风扇控制”，并让接管必须经过核验才生效。只改门禁与文案，本轮不改真机运行行为。

- [x] 记录只读证据：`cooling-levels`、三条 cooling map、`pwm_fan` 驱动写入路径
- [x] 新增 `kernel_takeover_ready_dir`（thermal 目录 + PWM 路径 + 两个开关 + `pwm-fan` 冷却设备）
- [x] 守护进程读取 `takeover_verified`，门禁改用新函数，配置默认 `takeover_verified '0'`
- [x] 高级设置文案改为“接管风扇控制”与全温度区间说明；zh_Hans 同步
- [x] Bats 覆盖门禁真假组合（34/34）
- [x] 重建并安装 APK，确认门禁仍关闭且文案生效（2026-11-22）
- [x] 真机有界交棒实测（2026-11-22，用户批准）：插件接管，`pwm1` 跟随请求；旧服务停用并取消开机自启

验收：默认配置下真机行为不变；只有在 `takeover_verified=1`、PWM 可写且存在 `pwm-fan` 冷却设备时才真正接管；文档与界面不再表述“100 °C 以上由内核接管风扇”。

## Brief log

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
