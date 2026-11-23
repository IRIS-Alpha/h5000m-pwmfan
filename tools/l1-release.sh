#!/bin/sh
# L1 release observation: hand the fan back to the kernel and sample what moves.
# Approved by the user on 2026-11-24. Aborts at 70 °C.
set -u
OUT=/tmp/l1-sample.log
: >"$OUT"
PWM=/sys/class/hwmon/hwmon2/pwm1
EN=/sys/class/hwmon/hwmon2/pwm1_enable
CS=/sys/class/thermal/cooling_device0/cur_state
TZ=/sys/class/thermal/thermal_zone0
ST=/var/run/h5000m-pwmfan/status

rd() {
	v=NA
	{ read -r v <"$1"; } 2>/dev/null || v=NA
	printf '%s' "$v"
}

field() {
	sed -n "s/^$1=//p" "$ST" 2>/dev/null
}

sample() {
	printf '%s pwm=%s en=%s cur_state=%s t4=%s t5=%s temp=%s state=%s reason=%s eff=%s\n' \
		"$(date +%s)" "$(rd "$PWM")" "$(rd "$EN")" "$(rd "$CS")" \
		"$(rd "$TZ/trip_point_4_temp")" "$(rd "$TZ/trip_point_5_temp")" "$(rd "$TZ/temp")" \
		"$(field state)" "$(field reason)" "$(field effective_pwm)" >>"$OUT"
}

echo "phase=baseline mode=$(uci get h5000m_pwmfan.main.mode) enabled=$(uci get h5000m_pwmfan.main.enabled)" >>"$OUT"
i=0
while [ "$i" -lt 4 ]; do
	sample
	i=$((i + 1))
	sleep 1
done

echo "phase=release" >>"$OUT"
uci set h5000m_pwmfan.main.enabled='0'
uci commit h5000m_pwmfan
/etc/init.d/h5000m-pwmfan restart >/dev/null 2>&1
sleep 1

abort=0
i=0
while [ "$i" -lt 60 ]; do
	sample
	temp=$(rd "$TZ/temp")
	if [ "$temp" != NA ]; then
		if [ "$temp" -gt 70000 ]; then
			abort=1
			echo "phase=abort temp=$temp" >>"$OUT"
			break
		fi
	fi
	i=$((i + 1))
	sleep 1
done

echo "phase=restore abort=$abort" >>"$OUT"
uci set h5000m_pwmfan.main.enabled='1'
uci commit h5000m_pwmfan
sleep 1
/etc/init.d/h5000m-pwmfan restart >/dev/null 2>&1
sleep 2
i=0
while [ "$i" -lt 8 ]; do
	sample
	i=$((i + 1))
	sleep 1
done
echo "phase=done" >>"$OUT"
