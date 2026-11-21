# H5000M PWM Fan V4 Handoff

Updated: 2026-11-22 (Asia/Shanghai)

## Canonical workspaces

- Primary package workspace: `/home/devcc/Projects/h5000m-pwmfan` in WSL
  Ubuntu-26.04, branch `main`, verified baseline `b5aaed7`.
- Associated firmware repository: `/mnt/e/WorkSpace/A20_Project/H5000M-CI-Qmodem-OP-git`
  (Windows: `E:\WorkSpace\A20_Project\H5000M-CI-Qmodem-OP-git`). This is a
  separate project and had pre-existing uncommitted changes when inspected;
  preserve them. Integrate the package there only after it is stable and the
  user asks to proceed.
- `/mnt/e/WorkSpace/A20_Project/H5000M-CI-Qmodem-OP-main` is a separate
  directory but not a Git checkout. Inspect and confirm its role before use.
- SDK, extracted firmware and supporting analysis live under
  `/home/devcc/Projects/.h5000m-work`. The October SDK only produced
  compatibility APKs and does not match the installed firmware LuCI baseline.
- The Windows package checkout `E:\WorkSpace\A20_Project\h5000m-pwmfan`
  is stale documentation-only history at `4e8de56`. Do not use it as the
  implementation baseline or overwrite WSL progress with its older tracker.

## Current state

- The WSL package already contains the LuCI views, controller, translations,
  project-local frontend skills, Vantage-backed preview and `AGENTS.md`.
- Visual baseline: `docs/REQUIREMENTS_V3.md`. Progress and acceptance blocks:
  `docs/TASKS.md`.
- Current UI proposal and evidence records:
  `docs/UIUX_IMPROVEMENTS_2026-11.md` and
  `docs/UIUX_RECHECK_2026-11-22.md`. The four earlier styling corrections
  have already been implemented and verified at 320/390/500/651/1360px in
  light and dark themes; do not list them as open without new evidence.
- Start the preview with
  `python3 tools/preview.py --port 8028 /home/devcc/Projects/.h5000m-work/rootfs`.
  Routes: `/cgi-bin/luci/admin/system/h5000m_pwmfan/dashboard` and
  `/cgi-bin/luci/admin/system/h5000m_pwmfan/advanced`.
- Latest recorded check: `STRICT=1 sh tools/check.sh`, 33/33 Bats tests pass.
  This is offline verification, not proof of live PWM takeover.
- Matching firmware SDK/APK verification, trusted installation and live
  kernel-trip handover remain open. Do not change live router PWM/thermal
  state during UI review.

## Resume order

1. Read `AGENTS.md`, the latest `docs/TASKS.md` entries,
   `docs/REQUIREMENTS_V3.md`, `docs/UIUX_IMPROVEMENTS_2026-11.md`, and
   `docs/UIUX_RECHECK_2026-11-22.md`.
2. Continue checking the remaining V4 proposals against the WSL source and
   preview. Record each as reproduced, not reproduced, or unresolved, with
   viewport and theme evidence.
3. The user asked to identify and record visual issues before fixing them.
   Do not change product code for newly found issues until confirmed. Keep
   0% semantics, save/apply behavior and the 3-second mode interval unresolved
   until decided.
4. Update `docs/TASKS.md` incrementally. Run preview checks and
   `STRICT=1 sh tools/check.sh` when relevant.
5. Keep development in the standalone package. The firmware repository is
   later integration context, not the package's parent branch.
