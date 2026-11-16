# H5000M PWM Fan Plugin Handoff

## Goal

Create a new LuCI package named `luci-app-h5000m-pwmfan` for H5000M. The package should allow configurable low-speed PWM without the current 50% one-size-fits-all floor, while retaining high-temperature emergency protection.

## Current project state

- Existing community build uses `luci-app-h5000m-fancontrol` from `FAN789/luci-app-h5000m-fancontrol`.
- Factory firmware package is `luci-app-fanctrol`, version `3.2.14-r19`.
- Factory package format is IPK/opkg, not APK.
- Factory package exact upstream source and license are unknown from the shipped firmware.
- Factory package files were extracted under `E:\WorkSpace\A20_Project\Temp\H5000M-fancontrol-analysis\package\luci-app-fanctrol`.
- Firmware and analysis manifest: `E:\WorkSpace\A20_Project\Temp\H5000M-fancontrol-analysis\MANIFEST.md`.
- Detailed analysis: `FANCONTROL_FIRMWARE_ANALYSIS.md`.

## Important technical facts

- Current router exposes `/sys/class/hwmon/hwmon2/pwm1` and a `pwm-fan` cooling device.
- Current kernel active cooling mapping creates a 128/255 floor around 40°C.
- A temporary patched controller successfully held PWM at 51/255 (~20%) for one minute; CPU stayed 49–53°C.
- Factory firmware's DTB did not show a CPU cooling-map entry pointing to the `pwm-fan` phandle, explaining why its userspace controller can use 20% directly.
- Factory UI/controller files are in the extracted package directory; it has no bundled license declaration.

## Next work

1. Create a new OpenWrt package repository in this workspace.
2. Decide whether to implement from the factory extraction or use the public FAN789 code as a base.
3. Define kernel fan ownership, configurable floor policy, startup boost, hysteresis, sensor selection, RPM absence, and failsafe behavior.
4. Add a package Makefile and H5000M build integration.
5. Test package installation, service ownership, PWM writes, thermal behavior, and rollback.

Do not assume the factory package is Apache-2.0; only the FAN789 package is publicly marked Apache-2.0.
