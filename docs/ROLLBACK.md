# Rollback and recovery

中文版本：[`ROLLBACK.zh-CN.md`](ROLLBACK.zh-CN.md)（与本文逐节对应，若有出入以本文为准）。

What this document covers: how to put the router back the way it was when the fan
plugin misbehaves, and how to prove that it is back. It is the procedure that
`docs/TASKS.md` asks for before live PWM and thermal changes are reviewed — the
plugin is allowed to write `pwm1` and to pin two thermal trips, so both need a
way back that does not depend on the plugin still working.

## What the package actually changes

| Item | Default on this firmware | While enabled |
|---|---|---|
| `thermal_zone0/trip_point_5_temp` | 40000 | 1000 (pinned permanently active) |
| `thermal_zone0/trip_point_4_temp` | 85000 | 114000 (third coldest − 1000) |
| `pwm1` (`/sys/devices/platform/pwm-fan/hwmon/hwmon2/pwm1`) | kernel governor | the plugin, every control cycle |
| `thermal_zone0/policy` | `step_wise` | repaired to `step_wise` if someone set `user_space` |
| Files | — | `/usr/sbin/h5000m-pwmfan*`, `/usr/lib/h5000m-pwmfan/`, the LuCI views, the catalogue, `/etc/config/h5000m_pwmfan` |

The original trip values are recorded in `/var/run/h5000m-pwmfan/thermal-takeover`
before anything is written. On the device today that file reads
`v1 5 40000 4 85000`, i.e. *trip 5 was 40 °C, trip 4 was 85 °C*.

## Take a snapshot first

```sh
ssh root@192.168.10.1 'sh -s' < tools/device-snapshot.sh > /tmp/router-before.txt
```

The script only reads. It prints the config, the package list, the status file,
every `hwmon` input, every thermal trip and cooling-device binding, file hashes
and the last log lines; that is exactly the set you need to diff afterwards.
`docs/device-baseline-20261123.md` is one such snapshot.

## L1 — Release control (normal rollback)

```sh
uci set h5000m_pwmfan.main.enabled='0'
uci commit h5000m_pwmfan
/etc/init.d/h5000m-pwmfan restart
```

The next control cycle sees `enabled != 1`, calls `thermal_takeover_restore()`
and `release_fan()`. Expect:

```sh
cat /var/run/h5000m-pwmfan/status      # state=disabled reason=released
cat /sys/class/thermal/thermal_zone0/trip_point_5_temp   # 40000
cat /sys/class/thermal/thermal_zone0/trip_point_4_temp   # 85000
ls /var/run/h5000m-pwmfan/thermal-takeover               # gone
```

Release writes **255** into `pwm1` on purpose, so a released fan runs at full
duty. Measured on 2026-11-24 (`docs/RUNTIME_EVIDENCE.md`): restoring the trips does
make the kernel re-evaluate the zone and `cooling_device0/cur_state` jumps to its
maximum (3) at that moment, **but the kernel does not then regulate the duty** --
a manual write of 51 stayed at 51 for twenty seconds with the zone sitting on the
lowest trip, and nothing pushed it back up.

Expect a released fan to stay at 255 until the plugin is re-enabled or the router
reboots. That is thermally safe (maximum cooling) and audibly obvious; it is not a
modulated hand-over, so do not wait for the fan to slow down on its own.

`kernel_takeover` does not need to change: it only gates taking control, and
`enabled=0` already releases it.

## L2 — Unpin the trips by hand

Use this when the daemon is gone (killed, uninstalled, package broken) but the
trips are still pinned. Stop the service first, otherwise the next cycle may
pin them again:

```sh
/etc/init.d/h5000m-pwmfan stop
read -r version cold_index cold_temp next_index next_temp \
	< /var/run/h5000m-pwmfan/thermal-takeover
echo "$next_temp" > /sys/class/thermal/thermal_zone0/trip_point_${next_index}_temp
echo "$cold_temp" > /sys/class/thermal/thermal_zone0/trip_point_${cold_index}_temp
rm -f /var/run/h5000m-pwmfan/thermal-takeover
```

Restore the higher trip first — the plugin does the same — so the zone never
holds both trips cold at once.

If the state file is already gone, the values are lost from memory; use the
snapshot from before the change (`docs/device-baseline-20261123.md` records the
same `v1 5 40000 4 85000`), or reboot and let the firmware restore them.

## L3 — Uninstall the package

```sh
apk del luci-app-h5000m-pwmfan luci-i18n-h5000m-pwmfan-zh-cn
```

Remaining after uninstall: `/etc/config/h5000m_pwmfan` (a conffile, kept on
purpose so a reinstall keeps the settings), the `/var/run` files until reboot,
and log lines. The APK we ship is not signed with the device trust key, so a
reinstall needs `apk add --allow-untrusted` — see `docs/BUILD_AND_INSTALL.md`.

## L4 — Go back to the legacy controller

The old `luci-app-h5000m-fancontrol` was removed on 2026-11-23. Its files are
backed up both on the device and in the workspace:

```sh
md5sum /root/h5000m-backup/legacy-fancontrol-20261123.tgz   # 09ba65f4c580663e0585250a7dd5d087
tar -xzf /root/h5000m-backup/legacy-fancontrol-20261123.tgz -C /
/etc/init.d/h5000m-fancontrol enable
/etc/init.d/h5000m-fancontrol start
```

The workspace copy is `C:\Users\31190\ego-h5000m\device-backup\`. Do not run both
controllers: uninstall or disable this package first (`L1` + `L3`).

## L5 — Reboot and firmware

Trip temperatures live in kernel memory, so a reboot returns them to the firmware
defaults, and `/var/run` (tmpfs) forgets the record of the original values with
them. A reboot is therefore the coarse reset, not the safe release: if
`enabled=1` and `takeover_verified=1` are still set, the daemon re-pins the trips
a few seconds after it starts.

To keep the plugin installed but inert across a reboot, run `L1` **before**
rebooting.

Firmware itself is untouched by any of this. If the router needs to go back to
stock, use sysupgrade with the vendor image and keep a copy of
`/etc/config/h5000m_pwmfan` if the settings matter later.

## Abort criteria for a live test

Stop the test and run `L1` if any of these happen:

- `state=fault` in the status file, or `logread | grep h5000m-pwmfan` shows a
  failsafe that does not clear within one cycle;
- `pwm1` **moves down on its own** and then the temperature climbs without the zone demanding it (a released fan holding 255 is expected, not a fault);
- the trip temperatures do not return to 40000 / 85000 after a release;
- the fan stops while `requested_pwm` is above 0 (the fan is the thing being
  protected; a silent fan is worse than a fast one).

## What a rollback does not restore

- `thermal_zone0/policy` stays `step_wise`. The plugin repairs `user_space` to
  `step_wise` and does not put it back; with the legacy controller gone,
  `step_wise` is the only remaining owner of the fan, so that is also where a
  rollback wants to end up. Set it back to `user_space` by hand only if a
  replacement userspace controller is running.
- `pwm1` is whatever the last writer left. After a release that is 255, and it stays there until the plugin writes again or the router reboots.
- The protection and temperature history files (they are runtime data).
- `/etc/config/h5000m_pwmfan` unless you delete it.
