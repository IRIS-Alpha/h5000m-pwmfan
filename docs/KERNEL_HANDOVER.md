# Kernel fan handover: evidence and decision points

Read-only evidence collected 2026-11-22 for the C-group items “confirm the kernel request on a natural trip crossing”
and “gate live PWM/thermal integration on reviewed runtime evidence and a rollback procedure”. **Nothing was changed
on the device**: no service was stopped, no PWM was written.

## What the device exposes

| Item | Value |
| --- | --- |
| Kernel | `6.18.60`, module `pwm_fan` loaded |
| hwmon fan node | `hwmon2`, name `pwmfan`, `pwm1=51`, `pwm1_enable=1`, no `fan1_input` (no tach) |
| Cooling device | `cooling_device0`, type `pwm-fan`, `cur_state=0`, `max_state=3` |
| `cooling-levels` (DT) | `0, 128, 192, 255` — big-endian u32 at `/sys/firmware/devicetree/base/pwm-fan/cooling-levels` |
| Zone | `thermal_zone0`, `cpu-thermal`, `step_wise`, `mode=enabled` |
| Trips | 40 °C active, 85 °C active, 115 °C active, 117 °C active, 120 °C hot, 125 °C critical |
| Zone→fan bindings | `cdev2` → trip 5 (40 °C), `cdev1` → trip 4 (85 °C), `cdev0` → trip 3 (115 °C), all → `cooling_device0`, weight 0 |
| Cooling maps (DT) | `cpu-passive` 40 °C → state 1, `cpu-active-low` 85 °C → state 2, `cpu-active-high` 115 °C → state 3, `cpu-active-hot` 117 °C → another cooling device 12 with `-1/-1` |
| Running writers | legacy `h5000m-fancontrol` (pid 18349) writes `pwm1`; the new daemon is gated off (`takeover_pending`) |

## Why a userspace writer silently defeats the kernel policy

Driver source, Linux `v6.18.60` `drivers/hwmon/pwm-fan.c`:

- `pwm_fan_write()` for `pwm1` calls `set_pwm()` and then `pwm_fan_update_state(ctx, val)`, which re-buckets the
  driver's cached state from the written value. Writing 51 puts the driver back to state 0.
- `pwm_fan_set_cur_state()` starts with `if (state == ctx->pwm_fan_state) return 0;` — it only applies a level when the
  requested state differs from that cached value.
- `__set_pwm()` returns early only for `enable_mode == pwm_off_reg_off` (0); `pwm1_enable=1`
  (`pwm_disable_reg_enable`) still applies the duty cycle while running, so the fan really does run at 51/255.

Consequence: the thermal governor keeps its own target (for example 1 after the first 40 °C crossing) while every
userspace write resets the driver's cached state to 0. The governor therefore never re-sends that level, and the fan
falls back to the userspace value within one poll interval. At 115 °C the governor sends state 3 once (target changes
1→3), the fan reaches 255, and the next userspace write overrides it again.

## What this means for the plugin

- The requirement “插件接管 −20 °C 至 100 °C 的 CPU 风扇控制” is consistent with the plugin owning `pwm1`.
- The requirement “高于 100 °C 的内核热区控制仍保持开启” (advanced-settings description) is **not what happens** while
  the plugin writes every poll interval: the kernel's fan steps at 85/115 °C are suppressed. CPU thermal throttling and
  the 125 °C critical trip are unaffected — they act on the CPU, not on the fan.
- The plugin's own protection already requests 100 % at `protection_temp` (default 90 °C, range 80–100), which is at
  least as strong as the kernel's 85 °C → 192 step. The gap is only the 40 °C → 128 step, which a low fixed duty or a
  low curve can sit below.

## Decision (2026-11-22)

Option B, phrased as a **global fan takeover** (`docs/REQUIREMENTS_V3.md` §17):

- While enabled, the plugin drives the fan at every temperature. The claim that the kernel thermal zone keeps the fan above 100 °C is dropped; CPU throttling and the 125 °C critical shutdown stay with the kernel.
- Takeover now requires evidence: `kernel_takeover=1` **and** `takeover_verified=1`, a writable PWM channel, and a cooling device whose `type` is `pwm-fan`. Until then the daemon keeps reporting `state=disabled reason=takeover_pending` and leaves the fan released.
- `takeover_verified` is set by hand only after the bounded live test below, and defaults to `0` in `root/etc/config/h5000m_pwmfan`.

## Options

| Option | Behaviour | Cost |
| --- | --- | --- |
| A. Mirror the kernel floors | compute `max(our_request, level_for(temp))` from `cooling-levels` + trip bindings, so the 40/85/115 steps always hold | duplicates kernel policy in the daemon; needs DT parsing; testable offline with fake sysfs |
| B. Own the band, fix the copy | keep the plugin as the only fan writer in −20…100 °C, and change the advanced text to say the fan is plugin-driven while CPU protection stays with the kernel | simplest; the 40 °C ≥ 50 % expectation stops applying; needs a requirement-text change |
| C. Defer above a threshold | stop writing above e.g. 100 °C and let the governor act | unreliable: the governor only re-sends on a target change, so it may never re-assert |

Recommendation: **B** for behaviour plus an explicit note, with **A** only if the 40 °C floor is actually wanted.
A low-duty mode sitting at 51/255 above 40 °C is a real difference from the stock policy, so the choice is a policy
question, not an implementation detail.

## Bounded live test (needs approval, not yet run)

1. Record baseline: `uci show h5000m_pwmfan`, `pwm1`, `cur_state`, zone temps, both service states, and a copy of
   `/etc/config/h5000m-fancontrol`.
2. Start a local watchdog on the router (independent of SSH) that restores the legacy service if the new daemon is not
   writing within 20 s.
3. Stop the legacy service, then start the new daemon with `kernel_takeover` enabled; sample every 2 s for 60 s.
4. Acceptance: `pwm1` tracks the plugin request, `state=running mode=<mode>` with `owner=plugin`, CPU stays below 70 °C,
   and stopping the daemon restores the legacy service.
5. Rollback: stop the new daemon, `/etc/init.d/h5000m-fancontrol start`, confirm `pwm1` and logread.

## Rollback procedure

```sh
/etc/init.d/h5000m-pwmfan stop
/etc/init.d/h5000m-fancontrol start
cat /sys/class/hwmon/hwmon2/pwm1          # expect the legacy value
logread | tail -20                         # no repeated errors
```

The plugin never changes `kernel_takeover` on its own, so disabling the service restores the previous writer. The
legacy service's own state file and config are untouched by this plugin.
