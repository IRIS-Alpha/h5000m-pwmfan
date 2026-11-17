# Test plan

Tests will use temporary directories that mirror the relevant sysfs and UCI
files. They must never write to the host's `/sys`, `/etc/config`, or service
directories.

The first Bats suite should cover:

- PWM discovery and explicit path selection;
- conversion between percentage and 0–255 PWM;
- ordered curve validation;
- startup kick and downshift hysteresis;
- invalid, stale, missing, and out-of-range temperature readings;
- PWM write failures and full-speed failsafe;
- missing RPM feedback;
- service stop, disable, upgrade, and rollback behavior;
- preservation of kernel passive, hot, and critical protection state.

Hardware validation remains separate from these tests and must record both the
requested PWM and the effective PWM read back from hwmon.

