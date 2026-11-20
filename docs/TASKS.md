# Project task tracker

## Work queue

- [x] Establish independent package repository and preserve handoff.
- [x] Configure lightweight engineering checks and planning documents.
- [x] Confirm Vantage upstream and theme integration approach.
- [x] Freeze initial v1 control and failure-state contract; hardware thresholds remain provisional.
- [x] Implement initial package metadata, UCI defaults, procd service, and controller.
- [x] Add initial isolated curve-helper tests; sensor/ownership/failsafe tests remain queued.
- [ ] Read-only runtime audit of thermal zones, cooling devices, pwm-fan requests/readback, and running/stopped service ownership before arbitration changes.
- [x] Add project working agreement and reconcile V3 historical discussion with confirmed control decisions.
- [ ] Implement/test pure target-drive (linear feed-forward + bounded PI) and global-protection state logic, blending, boost, lock/release, counts, and faults.
- [ ] Gate live PWM/thermal integration on reviewed runtime evidence and a device rollback procedure.
- [ ] Build and validate IPK with the OWT2510 matching ImmortalWrt buildroot/SDK.
- [x] Implement one-page LuCI status/control view, ACL/menu, quick dispatch, UCI settings, and zh-Hans translation package.
- [ ] Test page under Vantage dark/light/auto and small viewport with Playwright after obtaining the required LuCI 25.12 rootfs and replay mirror.
- [ ] Prepare optional H5000M thermal-map integration patch for later main-project feature.
- [ ] Hardware validation and rollback procedure.
- [ ] Select source redistribution license and replace temporary `UNKNOWN` metadata before publishing.

## Brief log

- 2026-11-17: Created independent `luci-app-h5000m-pwmfan` workspace and moved the handoff into it; initial commit `757cc30`.
- 2026-11-17: Added ShellCheck/shfmt/Bats/SDK preparation, CI scaffold, and initial requirements/UI drafts. Tool binaries are not installed in the Windows workspace.
- 2026-11-17: User specified one-page operation with dispatch presets, sensor array, curve, protection, language selection, and Vantage styling. Confirmed upstream `anothaDev/luci-theme-vantage`; theme owns light/dark/auto and responsive LuCI styling.
- 2026-11-17: Starting package backend first. Factory package remains reference-only due unknown license; current H5000M community package is the licensed behavior reference. New package will report requested and read-back PWM separately and will not disable CPU thermal protection.
- 2026-11-17: Added the standalone IPK Makefile, read-only-by-default UCI config, procd service, PWM controller, curve helper library, and initial Bats tests. High temperature and faults request fixed 255/255; the runtime status records read-back PWM to surface kernel/driver overrides. Git Bash syntax check was blocked by a Windows signal-pipe permission error; CI/Linux validation remains pending.
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
