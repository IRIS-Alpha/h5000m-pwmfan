# LuCI interface layout draft

The first UI pass should make the active control policy and the effective PWM
obvious before exposing advanced tuning.

The main firmware selects [Vantage](https://github.com/anothaDev/luci-theme-vantage).
Vantage restyles ordinary LuCI pages and owns light/dark/auto appearance and
mobile navigation. The package page should use native LuCI layout and theme
variables rather than copy Vantage's CSS or force a dark palette. The Vantage
repository keeps `luci-theme-vantage` and its optional dashboard in separate
packages; this package needs only to integrate with the theme.

## Page entry

- LuCI location: `Status → H5000M PWM Fan`.
- Compact Chinese/English selection in the page header; use LuCI's installed
  translation packages and locale behavior.
- The page must show whether the package is disabled, in automatic mode,
  manual mode, or kernel-protection-only mode.

## Primary view

1. **Status card**
   - service state;
   - control owner;
   - selected control temperature and source;
   - requested PWM and effective PWM;
   - last write result and last safety reason.
2. **Mode card**
   - automatic curve;
   - manual PWM;
   - kernel protection only;
   - apply/revert actions with a visible warning for manual mode.
3. **Temperature card**
   - available sensors and freshness;
   - selected source;
   - highest valid temperature used for protection.
4. **Curve card**
   - editable temperature/PWM points;
   - startup boost;
   - hysteresis and downshift delay;
   - validation that points are ordered and within 0–255 PWM.

## Advanced settings page

- fan hwmon path and PWM node;
- optional cooling-device association;
- minimum stable PWM and maximum PWM;
- sensor polling interval;
- failure-to-full-output policy;
- diagnostic paths and read-only kernel protection state.

Advanced controls live on a separate LuCI page and are grouped by protection,
downshift hysteresis, startup boost, fault response, and sampling/source.
Explain that effective output may exceed the request when kernel thermal
protection is active.

## Safety and interaction rules

- Never display a manual value as effective output without reading it back.
- Missing RPM must be shown as “no feedback”, not inferred as zero RPM.
- Invalid sensor or curve input must block apply and explain the correction.
- Stop, disable, and upgrade paths must expose the configured failsafe action.
- The UI must not offer a control that disables CPU passive, hot, or critical
  thermal protection.

