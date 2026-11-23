import io

p = "docs/RUNTIME_EVIDENCE.md"
s = io.open(p, encoding="utf-8").read()

old = """- early reboot: off by default (`early_reboot=0`); when on, the trigger is
  `min(protection_temp + 15, 110)` °C (105 °C at the default 90 °C threshold),
  held for 30 s, then `/sbin/reboot`. The hold is timed in `watchdog-hot`, and the
  check also runs while the controller is being rescued.
- cost: one file read per poll (2 s) plus one `date`; no extra processes.

Covered by `tests/watchdog.bats` (six cases: fresh, stale, missing status file,
foreign pid, reboot off, reboot hold).
"""
new = """- early reboot: off by default (`early_reboot=0`); when on, it fires in two
  cases. Above the protection threshold (`protection_temp`, default 90 °C) the
  temperature is timed in `watchdog-hot` and `/sbin/reboot` runs once it has
  stayed there for 20 s — at that point the fan is already locked at 100 % and
  has failed to pull the temperature back down. At the reboot point
  (`early_reboot_temp`, 100…120 °C, default 110 °C) it reboots at once: 125 °C is
  where the kernel shuts the board down, and a reboot itself takes a while with
  the CPU still at full load, so 15 °C of that gap is reserved for it. The check
  also runs while the controller is being rescued.
- cost: one file read per poll (2 s) plus one `date`; no extra processes.

Covered by `tests/watchdog.bats` (eleven cases: fresh, stale, missing status
file, foreign pid, reboot off, reboot point immediate, hold window, clock
cleared below the threshold, floor and ceiling clamps).
"""
assert s.count(old) == 1, "evidence paragraph"
s = s.replace(old, new, 1)
io.open(p, "w", encoding="utf-8").write(s)

p = "docs/TASKS.md"
s = io.open(p, encoding="utf-8").read()
marker = "Brief log: 2026-11-24"
idx = s.find(marker)
assert idx != -1
insert = """Brief log: 2026-11-24 (round 125) — the early-reboot point was reworked on the
user's correction: it is no longer `protection + 15`, and it is no longer a fixed
30 s hold at that point. Two triggers now: 20 s above the protection threshold
(fan already at 100 % and losing), or immediately at `early_reboot_temp`
(100…120 °C, default 110 °C = 125 °C shutdown trip minus 15 °C of reboot time).
The number is a field of its own so it can be lowered to 100 °C for this board,
whose reboot takes a while. Switch rows were also fixed to keep the switch on the
title line at every width, with the description on the line below.

"""
s = s[:idx] + insert + s[idx:]
io.open(p, "w", encoding="utf-8").write(s)
print("docs updated")
