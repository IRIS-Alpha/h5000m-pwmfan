#!/usr/bin/env bats
# shellcheck disable=SC2030,SC2031  # every case exports its own environment

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

@test "the early reboot stays off while the switch is off" {
	now=$(date +%s)
	status_file "$now"
	echo 115000 >"$WD_THERMAL/thermal_zone0/temp"
	export WD_EARLY_REBOOT=0 WD_PROTECTION_TEMP=90 WD_EARLY_REBOOT_TEMP=110
	run sh "$BATS_TEST_DIRNAME/../root/usr/sbin/h5000m-pwmfan-watchdog"
	[ "$status" -eq 0 ]
	[ ! -e "$ROOT/rebooted" ]
}

@test "reaching the reboot point fires at once, without waiting out the hold" {
	now=$(date +%s)
	status_file "$now"
	echo 110000 >"$WD_THERMAL/thermal_zone0/temp"
	export WD_EARLY_REBOOT=1 WD_PROTECTION_TEMP=90 WD_EARLY_REBOOT_TEMP=110
	run sh "$BATS_TEST_DIRNAME/../root/usr/sbin/h5000m-pwmfan-watchdog"
	[ "$status" -eq 0 ]
	[ -e "$ROOT/rebooted" ]
	grep -q "reboot point" "$ROOT/log"
}

@test "between the threshold and the point the clock has to run out first" {
	now=$(date +%s)
	status_file "$now"
	echo 95000 >"$WD_THERMAL/thermal_zone0/temp"
	export WD_EARLY_REBOOT=1 WD_PROTECTION_TEMP=90 WD_EARLY_REBOOT_TEMP=110
	run sh "$BATS_TEST_DIRNAME/../root/usr/sbin/h5000m-pwmfan-watchdog"
	[ "$status" -eq 0 ]
	[ ! -e "$ROOT/rebooted" ]
	[ -e "$WD_HOT_MARK" ]
}

@test "a temperature that stays above the threshold for the hold fires" {
	now=$(date +%s)
	status_file "$now"
	echo 95000 >"$WD_THERMAL/thermal_zone0/temp"
	printf '%s\n' $((now - 25)) >"$WD_HOT_MARK"
	export WD_EARLY_REBOOT=1 WD_PROTECTION_TEMP=90 WD_EARLY_REBOOT_TEMP=110
	run sh "$BATS_TEST_DIRNAME/../root/usr/sbin/h5000m-pwmfan-watchdog"
	[ "$status" -eq 0 ]
	[ -e "$ROOT/rebooted" ]
	grep -q "protection threshold" "$ROOT/log"
}

@test "a temperature below the protection threshold clears the clock" {
	now=$(date +%s)
	status_file "$now"
	echo 85000 >"$WD_THERMAL/thermal_zone0/temp"
	printf '%s\n' $((now - 60)) >"$WD_HOT_MARK"
	export WD_EARLY_REBOOT=1 WD_PROTECTION_TEMP=90 WD_EARLY_REBOOT_TEMP=110
	run sh "$BATS_TEST_DIRNAME/../root/usr/sbin/h5000m-pwmfan-watchdog"
	[ "$status" -eq 0 ]
	[ ! -e "$ROOT/rebooted" ]
	[ ! -e "$WD_HOT_MARK" ]
}

@test "a reboot point below the floor is raised to it" {
	now=$(date +%s)
	status_file "$now"
	echo 100000 >"$WD_THERMAL/thermal_zone0/temp"
	export WD_EARLY_REBOOT=1 WD_PROTECTION_TEMP=90 WD_EARLY_REBOOT_TEMP=90
	run sh "$BATS_TEST_DIRNAME/../root/usr/sbin/h5000m-pwmfan-watchdog"
	[ "$status" -eq 0 ]
	[ -e "$ROOT/rebooted" ]
}

@test "a reboot point inside the shutdown trip is pulled back" {
	now=$(date +%s)
	status_file "$now"
	echo 120000 >"$WD_THERMAL/thermal_zone0/temp"
	export WD_EARLY_REBOOT=1 WD_PROTECTION_TEMP=90 WD_EARLY_REBOOT_TEMP=130
	run sh "$BATS_TEST_DIRNAME/../root/usr/sbin/h5000m-pwmfan-watchdog"
	[ "$status" -eq 0 ]
	[ -e "$ROOT/rebooted" ]
}
