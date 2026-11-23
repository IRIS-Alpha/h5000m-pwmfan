# Device baseline, 2026-11-23 21:40 (+08:00)

Captured read-only over SSH (`uci export`, `apk list`, `/var/run`, `wc -c`, sysfs). Nothing on the router was changed by
this capture. Use it to diff or roll back later client work; the code side of the same moment is commit `efeef52`.

Panel: `192.168.10.1`, kernel `6.18.60`, up 4 days 7:35, load 0.45 / 0.18 / 0.11.

## Packages

| Package | Version |
| --- | --- |
| `luci-app-h5000m-pwmfan` | `0.1.0-r2` |
| `luci-i18n-h5000m-pwmfan-zh-cn` | `0.261122.40164` |
| `luci-app-h5000m-netmode` | `1.9.0-r3` |
| `luci-i18n-h5000m-netmode-zh-cn` | `26.315.63401~b2259b6` |

The legacy `luci-app-h5000m-fancontrol` is gone; its tarball is at `/root/h5000m-backup/legacy-fancontrol-20261123.tgz`
(md5 `09ba65f4c580663e0585250a7dd5d087`).

## Installed files

| Path | Bytes |
| --- | --- |
| `/usr/sbin/h5000m-pwmfan` | 23,487 |
| `/usr/sbin/h5000m-pwmfan-status` | 1,254 |
| `/usr/sbin/h5000m-pwmfan-history` | 847 |
| `/usr/lib/h5000m-pwmfan/controller-lib.sh` | 23,750 |
| `www/.../view/h5000m-pwmfan.js` | 42,968 |
| `www/.../view/h5000m-pwmfan-advanced.js` | 23,479 |
| `www/.../view/h5000m-pwmfan-shared.js` | 5,007 |
| `www/.../view/h5000m-pwmfan.css` | 17,490 |
| `/usr/lib/lua/luci/i18n/h5000m-pwmfan.zh-cn.lmo` | 11,456 |

## UCI

```uci
config settings 'main'
	option enabled '1'
	option mode 'fixed'
	option fixed_duty '5'
	option sensor_sources 'auto'
	option min_pwm '51'
	option max_pwm '255'
	option manual_pwm '128'
	option kick_pwm '204'
	option kick_ms '800'
	option hysteresis '2'
	option down_delay '5'
	option poll_interval '2'
	option safety_temp '85'
	option drive 'duty'
	option duty_quiet '70'
	option duty_balanced '50'
	option duty_performance '80'
	option target_temp '85'
	option response_range '15'
	option transition_width '5'
	option target_idle_pwm '0'
	option protection_temp '90'
	option protection_radius '15'
	option protection_release '3'
	option kernel_takeover '1'
	option takeover_verified '1'
	option curve_mode 'quiet'
	option history_range '10'
	option history_interval '2'
	option curve_quiet '35:51,45:64,55:96,65:160,75:224,85:255'
	option curve_balanced '30:64,42:96,54:144,66:200,76:240,84:255'
	option curve_performance '25:128,34:160,43:192,52:224,61:240,70:255'
	option curve_custom '30:51,40:64,50:96,60:144,70:208,80:255'
	option curve_manual '30:51,40:64,50:96,60:144,70:208,80:255'
```

`vantage_theme`: `option theme 'dark'`, `option chart 'overlay'`.

## Runtime status

```
state=running
reason=mode
mode=fixed
owner=userspace
temperature_mc=46537
control_source=tz_thermal_zone0
safety_temperature_mc=46537
safety_source=tz_thermal_zone0
requested_pwm=51
effective_pwm=51
protection_pwm=0
mode_pwm=51
floor_pwm=51
floor_limited=1
stale_temperature=0
writes_total=2
sensors=tz_thermal_zone0|cpu-thermal|46537|ok;hwmon0_temp1|mdio_bus:01_temp1|42000|ok;hwmon1_temp1|cpu_thermal_temp1|46387|ok;hwmon3_temp1|mt7996_phy0.0_temp1|34000|ok;hwmon4_temp1|mt7996_phy0.1_temp1|34000|ok;modem|modem|--|missing
```

`fixed_duty=5` explains `floor_limited=1`: 5 % of 255 is 12, below `min_pwm` 51, so the non-zero request floor applies and
the fan sits at 51/255 (20 %).

## Thermal

`thermal_zone0` (`cpu-thermal`): `policy=step_wise`, `mode=enabled`, six trips with hyst 2,000:

| Trip | Temp | Type |
| --- | --- | --- |
| 0 | 125,000 | critical |
| 1 | 120,000 | hot |
| 2 | 117,000 | active |
| 3 | 115,000 | active |
| 4 | 114,000 | active |
| 5 | 1,000 | active |

Cooling devices: `cooling_device0` `pwm-fan` max 3 cur 0, `cooling_device1` `mt7996_phy0.0` max 99, `cooling_device2`
`mt7996_phy0.1` max 99. Zone 0 binds trips 3, 4 and 5 to cdevs 0, 1, 2 respectively — trip 5 at 1,000 m°C is the pinned
low trip that keeps `step_wise` from dropping the fan to zero under our control.
