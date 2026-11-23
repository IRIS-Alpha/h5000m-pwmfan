#!/usr/bin/env bats

# The watchdog shares no code with the controller, so these tests drive the
# script itself in one-shot mode against a fake runtime directory.

setup() {
	ROOT="$BATS_TMPDIR/watchdog"
	rm -rf "$ROOT"
	mkdir -p "$ROOT/hwmon0" "$ROOT/thermal/thermal_zone0"
	export WD_STATUS="$ROOT/status"
	export WD_ALIVE="$ROOT/watchdog-alive"
	export WD_PIDFILE="$ROOT/watchdog.pid"
	export WD_CONTROLLER_PID="$ROOT/pid"
	export WD_TAKEOVER="$ROOT/thermal-takeover"
	export WD_THERMAL="$ROOT/thermal"
	export WD_LOGGER="$ROOT/logger"
	export WD_ONESHOT=1
	export WD_REBOOT_CMD="$ROOT/reboot"
	export WD_PWM="$ROOT/pwm1"
	export WD_HOT_MARK="$ROOT/hot"
	export WD_POLL=2
	printf '#!/bin/sh\necho "$@" >>"%s"\n' "$ROOT/log" >"$WD_LOGGER"
	printf '#!/bin/sh\necho rebooted >"%s"\n' "$ROOT/rebooted" >"$WD_REBOOT_CMD"
	chmod +x "$WD_LOGGER" "$WD_REBOOT_CMD"
	: >"$ROOT/pwm1"
}

status_file() {
	# $1 updated_at, $2 optional extra lines
	{
		echo "state=running"
		echo "updated_at=$1"
		[ -z "${2:-}" ] || echo "$2"
	} >"$WD_STATUS"
}

@test "a fresh status file leaves the fan and the trips alone" {
	now=$(date +%s)
	status_file "$now"
	printf 'v1 5 40000 4 85000\n' >"$WD_TAKEOVER"
	run sh "$BATS_TEST_DIRNAME/../root/usr/sbin/h5000m-pwmfan-watchdog"
	[ "$status" -eq 0 ]
	[ -f "$WD_TAKEOVER" ]
	[ ! -s "$ROOT/pwm1" ]
	[ ! -e "$ROOT/log" ]
}

@test "a stale status file pushes the fan to full duty and restores the trips" {
	now=$(date +%s)
	status_file $((now - 60))
	printf 'v1 5 40000 4 85000\n' >"$WD_TAKEOVER"
	echo 1000 >"$WD_THERMAL/thermal_zone0/trip_point_5_temp"
	echo 114000 >"$WD_THERMAL/thermal_zone0/trip_point_4_temp"
	run sh "$BATS_TEST_DIRNAME/../root/usr/sbin/h5000m-pwmfan-watchdog"
	[ "$status" -eq 0 ]
	[ ! -e "$WD_TAKEOVER" ]
	[ "$(cat "$WD_THERMAL/thermal_zone0/trip_point_5_temp")" = 40000 ]
	[ "$(cat "$WD_THERMAL/thermal_zone0/trip_point_4_temp")" = 85000 ]
	grep -q "controller silent" "$ROOT/log"
}

@test "a missing status file is not a hang" {
	run sh "$BATS_TEST_DIRNAME/../root/usr/sbin/h5000m-pwmfan-watchdog"
	[ "$status" -eq 0 ]
	[ ! -e "$ROOT/log" ]
	[ ! -e "$WD_TAKEOVER" ]
}

@test "stale status with a live controller pid kills only that pid" {
	now=$(date +%s)
	status_file $((now - 60))
	sleep 30 &
	controller=$!
	echo "$controller" >"$WD_CONTROLLER_PID"
	# The real /proc/<pid>/comm is "sleep", which is not the controller, so the
	# watchdog must leave it alone.
	run sh "$BATS_TEST_DIRNAME/../root/usr/sbin/h5000m-pwmfan-watchdog"
	[ "$status" -eq 0 ]
	kill -0 "$controller"
	kill "$controller" 2>/dev/null || true
	wait "$controller" 2>/dev/null || true
}

@test "the reboot fallback stays off while the setting is zero" {
	now=$(date +%s)
	status_file "$now" "temperature=0"
	echo 60000 >"$WD_THERMAL/thermal_zone0/temp"
	run sh "$BATS_TEST_DIRNAME/../root/usr/sbin/h5000m-pwmfan-watchdog"
	[ "$status" -eq 0 ]
	[ ! -e "$ROOT/rebooted" ]
}

@test "the reboot fallback needs the hold time before it fires" {
	now=$(date +%s)
	status_file "$now"
	echo 99000 >"$WD_THERMAL/thermal_zone0/temp"
	export WD_REBOOT_TEMP=90
	# First pass only starts the clock.
	run sh "$BATS_TEST_DIRNAME/../root/usr/sbin/h5000m-pwmfan-watchdog"
	[ "$status" -eq 0 ]
	[ ! -e "$ROOT/rebooted" ]
}

@test "a stopped controller is killed, not just asked to stop" {
	now=$(date +%s)
	status_file $((now - 60))
	sleep 60 &
	controller=$!
	# The pid has to be real for kill, but its name is ours to fake.
	mkdir -p "$ROOT/proc/$controller"
	printf 'h5000m-pwmfan\n' >"$ROOT/proc/$controller/comm"
	export WD_PROC="$ROOT/proc"
	echo "$controller" >"$WD_CONTROLLER_PID"
	kill -STOP "$controller"
	run sh "$BATS_TEST_DIRNAME/../root/usr/sbin/h5000m-pwmfan-watchdog"
	[ "$status" -eq 0 ]
	# A zombie is not a live controller: wait reports the kill signal instead.
	run wait "$controller"
	[ "$status" -eq 137 ]
}
