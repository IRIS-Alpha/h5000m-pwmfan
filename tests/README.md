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

# Preview regression test

`tests/preview.mjs` drives the running preview in a real browser and checks what
the pages are actually made of, so a markup or layout regression fails instead of
slipping through a visual review.

```sh
# 1. serve the views (from the repository root)
python3 tools/preview.py --port 8028 /path/to/rootfs

# 2. run the test where Playwright is resolvable
NODE_PATH=/path/to/node_modules node tests/preview.mjs
```

Environment:

| Variable | Meaning |
| --- | --- |
| `PWMFAN_PREVIEW_URL` | The dashboard page URL, e.g. `http://127.0.0.1:8028/cgi-bin/luci/admin/system/h5000m_pwmfan/dashboard` (the advanced page is derived from it) |
| `PWMFAN_PREVIEW_OUTPUT` | Screenshot directory, skipped when unset |

What it covers:

- dashboard structure: five drive modes, two labelled canvases, the four-key curve
  legend with values flush to the right of each column, the floor and stale chips
  starting hidden;
- the fixed-request method: slider, countdown save bar, apply;
- the theme button cycling through auto, light and dark;
- status-driven UI: a `state=disabled` snapshot reads "not in control", a
  `stale_temperature=1` snapshot lights the stale chip (the ubus response is
  rewritten in flight, so no file on disk changes);
- a 10 × 3 responsive and theme matrix at 320 to 1360 pixels: no horizontal
  overflow, chips inside the card and never overlapping, legend columns aligned,
  the dispatch header keeping its height;
- the advanced form: seven behaviour cards, one takeover toggle, the unit hosts,
  no collapsed description, sensor options carrying readings, and a save round
  trip on `protection_temp`.

Two notes on the harness:

- static assets are served from the repository's `htdocs/`, not from the rootfs
  copy, so a preview run always reflects the working tree;
- the preview has no `cgi-exec` and no `uci/apply_rollback`, and its sensor field
  is a plain `<select>` while the router's theme renders a dropdown. The test
  accepts both shapes and ignores those two preview-only 404s.

`tools/check.sh` runs this file only when `PWMFAN_PREVIEW_URL` is set, so the normal
check stays offline.

