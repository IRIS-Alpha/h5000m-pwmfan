# Requirements analysis

This document records the requirements to settle before implementing the
package. It is intentionally separate from the main OpenWrt firmware project.

## Confirmed goals

- Package name: `luci-app-h5000m-pwmfan`.
- Target: Hiveton H5000M and its current OpenWrt IPK/opkg environment.
- Allow a configurable low PWM output below the current effective 128/255
  floor when the user explicitly enables the package's fan ownership policy.
- Keep CPU passive throttling, high-temperature, and critical protection.
- Provide a LuCI page for status, mode, curve, manual PWM, sensor selection,
  and safety parameters.
- Fail safe when temperature input, PWM discovery, or writes are invalid.
- Keep the package independently buildable; integration into the main firmware
  repository happens only after package-level validation.
- Keep the primary LuCI workflow on one page: quick dispatch selection,
  temperature array, curve control, safety protections, and language choice.
- Match the installed Vantage theme by consuming LuCI/theme styles and tokens;
  support Vantage light, dark, and automatic appearance modes without forcing
  a package-specific color scheme.

## Current target baseline

- Main project target label: OWT2510.
- Device: Hiveton H5000M, ARMv8, MediaTek mediatek/filogic.
- Reported firmware: ImmortalWrt SNAPSHOT r0-a4ba824, LuCI Master
  26.315.10273~ad75cde, custom image build IRIS-Alpha-26.11.15-14.22.58.
- Reported kernel: Linux 6.18.60.
- Package format: IPK/opkg.
- SDK/build validation must use the matching OWT2510 ImmortalWrt buildroot and
  feed revisions. The reported firmware is a moving snapshot, so its exact
  source commit and kernel build configuration must be captured when selecting
  the build environment.
- Temperatures and load in the supplied device report are point-in-time
  telemetry, not validated safety thresholds or acceptance criteria.

## Explicit non-goals for the first version

- Reconstructing or redistributing the factory `luci-app-fanctrol` source.
- Adding a custom kernel module.
- Supporting arbitrary boards or GPIO-only fans.
- Replacing the kernel thermal governor globally.
- Treating missing RPM feedback as proof that the fan is stopped.

## Decisions required before implementation

1. Fan ownership: use an H5000M device-tree patch, a narrowly scoped runtime
   policy, or a hybrid. The selected approach must leave passive, hot, and
   critical CPU protection intact.
2. Minimum output: configurable `min_pwm`, startup kick value/duration, and
   whether the minimum is allowed only in manual mode or also in automatic
   curves.
3. Sensor policy: CPU only, highest valid H5000M sensor, or user-selected
   sources with a maximum-temperature safety override.
4. Hysteresis and downshift delay: defaults and whether they apply to manual
   mode.
5. Failure behavior: full PWM on invalid temperature/PWM access, and the exact
   behavior for service stop, disable, and package upgrade.
6. LuCI compatibility: JavaScript view and current LuCI version supported by
   the main firmware.
7. License boundary: only code with a confirmed compatible license may be
   reused; factory extraction remains reference material.

## V1 implementation contract

- Keep package installation read-only by default. The daemon may report
  temperatures and current PWM, but the user must explicitly enable fan control
  before it writes the PWM node.
- Use `pwm1` from the H5000M `pwmfan` hwmon device; discover it by hwmon name
  instead of assuming an `hwmonN` index.
- Provide quick modes for quiet, balanced, performance, custom, manual, and
  kernel-protection-only operation.
- In automatic mode, use the highest valid reading among user-selected H5000M
  sources. The high-temperature override always monitors every available valid
  source, including sources excluded from curve selection. Never interpret a
  missing, stale, malformed, or out-of-range reading as zero degrees.
- Apply a 5G modem thermal-throttle floor when fresh modem telemetry reports a
  throttling level, even when modem temperature is not selected for curve
  control.
- On invalid temperature data or a failed PWM write while the package owns the
  fan, request fixed full PWM (255/255) and report the failure reason.
- On disable or service exit, request full PWM before releasing ownership;
  kernel passive, hot, and critical protections remain enabled.
- Report the requested PWM and immediate sysfs read-back separately. Kernel
  thermal control may still raise or replace the userspace request until the
  main firmware integrates the reviewed cooling-map change.
- RPM is optional telemetry. Missing tach input is reported as unavailable,
  never as a stopped fan.
- Treat current temperature curves and the 51/255 low-duty observation as
  provisional. Confirm start duty, stable duty, and safe curve on hardware.
- The source redistribution license is undecided. `PKG_LICENSE:=UNKNOWN` is a
  metadata placeholder; do not publish a release until the project license is
  selected and its license text is included.

## Acceptance evidence

- IPK builds from an OpenWrt SDK.
- Installation, upgrade, stop, and rollback are repeatable.
- Fake-sysfs tests cover normal control, invalid readings, write failures,
  startup kick, hysteresis, and failsafe.
- On H5000M, requested PWM and effective PWM are both observable.
- Thermal behavior is checked with the kernel protection nodes unchanged.

