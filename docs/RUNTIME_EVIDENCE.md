# Runtime evidence

This file collects what has actually been measured about the package while it runs
on the H5000M, so the "gate live PWM and thermal integration on reviewed runtime
evidence" item in `docs/TASKS.md` has something to review. It separates three
kinds of statements: **measured** (a number and a command), **read from code**
(a path and a line), and **reported** (verified earlier by the user by hand, not
re-run for this file).

Rollback and recovery live in `docs/ROLLBACK.md`; the device snapshot that these
numbers come from is `docs/device-baseline-20261123.md` and
`tools/device-snapshot.sh`.

## Topology (measured 2026-11-24)

One thermal zone carries the fan:

```
thermal_zone0  type=cpu-thermal  policy=step_wise  temp≈46–51 °C
  cdev0 -> cooling_device0 (pwm-fan, max_state 3)  trip 3 = 115000 m°C  weight 0
  cdev1 -> cooling_device0 (pwm-fan, max_state 3)  trip 4 =  85000 m°C  weight 0
  cdev2 -> cooling_device0 (pwm-fan, max_state 3)  trip 5 =  40000 m°C  weight 0
```

All three bindings point at the same cooling device; trips 4 and 5 are the two
coldest, which is why the takeover pins exactly those two. `cooling_device1` and
`cooling_device2` (`mt7996_phy0.0/.1`) are not bound to this zone, so pinning the
fan trips does not delay the PHY throttle.

The fan itself has no tachometer: `hwmon2` exposes `pwm1` and `pwm1_enable` only.
Every statement below about duty is therefore a statement about the value written
to and read back from `pwm1`, never about the blade.

## Ownership

- The plugin takes the fan when `enabled=1`, `kernel_takeover=1` and
  `takeover_verified=1`, the `pwm1` path is writable, and a `pwm-fan` cooling
  device exists (`kernel_takeover_ready_dir()`, `root/usr/lib/h5000m-pwmfan/controller-lib.sh:493`).
- Taking over pins trips 4 and 5 (`thermal_takeover_apply()`,
  `controller-lib.sh:538`): trip 5 becomes 1000 m°C and trip 4 becomes
  "third coldest − 1000", so the governor cannot demand a zero duty or override
  the configurable over-temperature policy. The original pair is written to
  `/var/run/h5000m-pwmfan/thermal-takeover` first (`v1 <cold> <cold_temp> <next> <next_temp>`).
- Releasing restores the pair in the opposite order and deletes the record
  (`thermal_takeover_restore()`, `controller-lib.sh:570`). A write to
  `trip_point_*_temp` makes the kernel re-evaluate the zone, which is what wakes
  `step_wise` after a release — the pin alone did not leave a state to restore,
  only a trip that the governor had already crossed.
- **Measured**: while the plugin owns the fan, `cooling_device0/cur_state` is `0`
  and `pwm1` is whatever the plugin wrote (51 at the time of measurement). The
  governor is idle, not fighting the plugin.
- Releasing writes 255 into `pwm1` (`release_fan()`, `root/usr/sbin/h5000m-pwmfan:269`),
  so a hand-over starts from full duty and the governor lowers it on the next
  zone update.

## The request pipeline (read from code)

1. `requested_pwm()` (`root/usr/sbin/h5000m-pwmfan:430`) turns the mode into a
   duty: `fixed:*` uses `fixed_duty`, the three presets use `duty_*`, everything
   else reads the curve. It prints `<applied> <raw>`.
2. A zero request stays zero; every other request is clamped into
   `min_pwm … max_pwm`. `floor_limited` is raised when the raw request was
   non-zero and below the floor (line 474).
3. `protection_dispatch_step()` can override the request with a protection ramp
   or a lock; only those reasons set `protection_pwm` (line 478 in the earlier
   round's evidence, still the same `case`).
4. The modem floor can raise the duty (`modem_throttle_floor`, line 601).
5. The startup kick is clamped into the same floor and ceiling (line 616).

So `min_pwm` is a floor for **requests**, not a guarantee that the fan turns: at
`fixed_duty=5` the resolved duty is 51/255 = 20 %, and `floor_limited=1` reports
that the request was raised.

## Failure paths (read from code)

| Situation | Behaviour | Where |
|---|---|---|
| No valid control or safety temperature for two cycles | hold the last valid value, `stale_temperature=1`, blue 「温度过期」 chip; after that, `failsafe no_valid_temperature` → 100 % | `apply_cycle()` around line 552 |
| `pwm1` missing or not writable | `fault pwmfan_not_found` → writes `failsafe_pwm` (255) | line 521 |
| A write to `pwm1` fails | `fault release_write_failed` / `..._and_failsafe_write_failed`, owner cleared | `set_pwm()`, `release_fan()` |
| Invalid config | `mode=invalid`, `fault invalid_configuration`, fan goes to 100 % if it had been owned | `apply_cycle()` early return |
| Thermal zone without three fan trips | the pin is refused, the takeover stays in `takeover_pending` | `thermal_takeover_apply()` |

## Sensor arbitration (measured)

`status` reports `control_source` (feeds the curve/target) and `safety_source`
(arbitrates the safety maximum) separately. On the device with
`sensor_sources=auto`, both pointed at `hwmon1_temp1` (46.4 °C) while trip 0
(`cpu-thermal`) read 51.3 °C — the two are different sensors, so "auto" is not
the same as "the hottest one". A source counts only when its file is readable and
its value is inside −40…150 °C.

## Cost (measured 2026-11-24, `poll_interval=2`)

40 s = 20 cycles, read from `/proc/<pid>/stat` (utime+stime for the daemon,
cutime+cstime for its children):

```
self 380 ms  children 790 ms  total 1170 ms  →  58.5 ms per cycle (19 + 39.5)
```

That is 2.9 % of one core at the default two-second cycle, after the round-107
work (`read` instead of `cat`, cached fan path, one clock read, `/proc/uptime`
timing). The previous baseline was 137 ms per cycle (6.8 %).

Memory: VMRSS 1.6 MB, VSZ 1.8 MB, one thread (measured in the Rust evaluation,
`docs/TASKS.md`).

## Reported by the user, not re-measured here

- The replaced fan starts from standstill through the startup kick and then holds.
- With the kick disabled and the floor protection off, the lowest duty that keeps
  the fan turning is **8 %** (1 % steps from 1 %).
- The kick has been verified repeatedly in earlier rounds.

These three close the manual-testing questions that were open in the previous
round. They are recorded here as reported facts with that caveat: the board has no
tachometer, so they cannot be re-derived from the device.

## Still open

- **Natural trip crossing after a release.** Everything above explains what
  *should* happen; nobody has yet watched `cur_state` and `pwm1` move on their own
  after `docs/ROLLBACK.md` L1. This is the last open item before the live gate can
  be called reviewed.
- **Cold boot.** Deferred by the user on 2026-11-24.
- **Governor duty per level.** `max_state` is 3, so `step_wise` can ask for three
  levels; which duty each level maps to has not been observed on the new fan.
