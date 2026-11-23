#!/bin/sh
# Second L1 observation: while the kernel owns the fan, force a lower duty by
# hand and see whether the kernel puts it back. Approved inside the same L1 window.
set -u
OUT=/tmp/l1-poke.log
: >"$OUT"
PWM=/sys/class/hwmon/hwmon2/pwm1
CS=/sys/class/thermal/cooling_device0/cur_state
TZ=/sys/class/thermal/thermal_zone0
ST=/var/run/h5000m-pwmfan/status

rd() {
	v=NA
	{ read -r v <"$1"; } 2>/dev/null || v=NA
	printf '%s' "$v"
}
field() { sed -n "s/^$1=//p" "$ST" 2>/dev/null; }
sample() {
	printf '%s pwm=%s cur_state=%s t4=%s t5=%s temp=%s state=%s\n' \
		"$(date +%s)" "$(rd "$PWM")" "$(rd "$CS")" \
		"$(rd "$TZ/trip_point_4_temp")" "$(rd "$TZ/trip_point_5_temp")" "$(rd "$TZ/temp")" \
		"$(field state)" >>"$OUT"
}

echo "phase=release" >>"$OUT"
uci set h5000m_pwmfan.main.enabled='0'
uci commit h5000m_pwmfan
/etc/init.d/h5000m-pwmfan restart >/dev/null 2>&1
sleep 2
i=0
while [ "$i" -lt 3 ]; do
	sample
	i=$((i + 1))
	sleep 1
done

echo "phase=poke pwm1=51" >>"$OUT"
echo 51 >"$PWM"
sleep 1
i=0
while [ "$i" -lt 20 ]; do
	sample
	i=$((i + 1))
	sleep 1
done

echo "phase=restore" >>"$OUT"
uci set h5000m_pwmfan.main.enabled='1'
uci commit h5000m_pwmfan
sleep 1
/etc/init.d/h5000m-pwmfan restart >/dev/null 2>&1
sleep 2
i=0
while [ "$i" -lt 6 ]; do
	sample
	i=$((i + 1))
	sleep 1
done
echo "phase=done" >>"$OUT"
