# luci-app-h5000m-pwmfan

Independent LuCI package project for the Hiveton H5000M OWT2510 firmware target. The first
implementation milestone is the package backend; the single-page LuCI view is
tracked separately in [docs/TASKS.md](docs/TASKS.md).

## Current behavior contract

- Installation is read-only by default (`enabled=0`): the daemon reports
  available temperatures and current PWM but does not write to the fan.
- The controller discovers the writable `pwm1` node by the hwmon device name
  `pwmfan`; it never assumes an `hwmonN` index.
- Automatic modes use the highest valid selected temperature from thermal and
  hwmon sysfs nodes. The safety override monitors every valid source regardless
  of curve selection. Invalid or missing readings never become zero degrees.
- Fresh 5G modem telemetry may raise requested PWM according to its throttle
  level even when it is not the selected curve-control source.
- Manual mode still requires a valid temperature source so the high-temperature
  override remains active.
- `kernel` mode does not write PWM. CPU passive throttling and hot/critical
  kernel protection are outside this package and are never disabled here.
- A control fault or safety-temperature trip requests PWM 255. The status file
  reports requested and read-back values separately because kernel thermal
  control may override userspace output.
- Missing fan RPM feedback is not treated as a fault.

The default curves and 51/255 low-duty floor are provisional. Confirm fan start
duty, minimum stable duty, and safe temperatures on H5000M hardware before
changing firmware defaults.

## OpenWrt package build

Place this repository in an OpenWrt source tree as
`package/luci-app-h5000m-pwmfan`, then build:

```sh
make package/luci-app-h5000m-pwmfan/compile V=s
```

The target firmware is OWT2510 based on ImmortalWrt SNAPSHOT, LuCI Master,
mediatek/filogic, and Linux 6.18.60. The device uses APK packages managed by apk-tools.
Build and validate against the exact OWT2510 ImmortalWrt source revision and
its feeds, or an SDK produced from that same buildroot; do not substitute an
unrelated stable OpenWrt SDK. Integration into the main firmware project comes
after package validation.

This package is licensed under Apache-2.0; see [LICENSE](LICENSE). Third-party
components retain their own licenses and notices.

## Development checks

```sh
STRICT=1 sh tools/check.sh
```

The Bats suite only exercises pure control helpers. Device-tree ownership and
hardware thermal behavior require separate integration tests.

