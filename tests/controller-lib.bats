#!/usr/bin/env bats

setup() {
	# shellcheck source=root/usr/lib/h5000m-pwmfan/controller-lib.sh
	. "$BATS_TEST_DIRNAME/../root/usr/lib/h5000m-pwmfan/controller-lib.sh"
}

@test "accepts a strictly ascending curve with bounded PWM values" {
	run curve_validate '30:51,45:100,70:255'
	[ "$status" -eq 0 ]
}

@test "rejects curves with fewer than two points" {
	run curve_validate '45:100'
	[ "$status" -ne 0 ]
}

@test "rejects duplicate or descending temperatures" {
	run curve_validate '30:51,30:90'
	[ "$status" -ne 0 ]
	run curve_validate '45:90,30:51'
	[ "$status" -ne 0 ]
}

@test "rejects malformed and out-of-range PWM values" {
	run curve_validate '30:51,45:256'
	[ "$status" -ne 0 ]
	run curve_validate '30:51x,45:100'
	[ "$status" -ne 0 ]
}

@test "holds the endpoint PWM outside the curve range" {
	[ "$(curve_value '30:51,70:251' 10)" -eq 51 ]
	[ "$(curve_value '30:51,70:251' 90)" -eq 251 ]
}

@test "linearly interpolates PWM between curve points" {
	[ "$(curve_value '30:50,70:250' 50)" -eq 150 ]
}

@test "clamps a requested PWM to configured bounds" {
	[ "$(clamp_pwm 10 51 220)" -eq 51 ]
	[ "$(clamp_pwm 250 51 220)" -eq 220 ]
	[ "$(clamp_pwm 128 51 220)" -eq 128 ]
}

@test "accepts valid negative and positive millidegree temperatures" {
	valid_temp_mc -40000
	valid_temp_mc 49999
	valid_temp_mc 150000
}

@test "rejects missing, malformed, and out-of-range temperatures" {
	run valid_temp_mc ''
	[ "$status" -ne 0 ]
	run valid_temp_mc 42C
	[ "$status" -ne 0 ]
	run valid_temp_mc 150001
	[ "$status" -ne 0 ]
	run valid_temp_mc --12
	[ "$status" -ne 0 ]
}

@test "accepts only integer modem temperatures in Celsius range" {
	valid_temp_c -40
	valid_temp_c 72
	run valid_temp_c 151
	[ "$status" -ne 0 ]
	run valid_temp_c 72.5
	[ "$status" -ne 0 ]
}

@test "converts modem thermal throttling levels to PWM floors" {
	[ "$(modem_throttle_pwm 0)" -eq 0 ]
	[ "$(modem_throttle_pwm 1)" -eq 128 ]
	[ "$(modem_throttle_pwm 2)" -eq 192 ]
	[ "$(modem_throttle_pwm 3)" -eq 255 ]
	run modem_throttle_pwm 4
	[ "$status" -ne 0 ]
}

@test "unselected sensors remain in the high-temperature safety maximum" {
	# Globals are consumed by record_sensor.
	# shellcheck disable=SC2034
	SENSOR_SELECTION=cpu
	CONTROL_TEMP_MC=
	CONTROL_SOURCE=
	SAFETY_TEMP_MC=
	SAFETY_SOURCE=
	SENSOR_STATUS=
	record_sensor cpu cpu 45000 ok
	record_sensor wifi wifi 91000 ok
	[ "$CONTROL_TEMP_MC" -eq 45000 ]
	[ "$CONTROL_SOURCE" = cpu ]
	[ "$SAFETY_TEMP_MC" -eq 91000 ]
	[ "$SAFETY_SOURCE" = wifi ]
	case "$SENSOR_STATUS" in *'wifi|wifi|91000|unselected'*) ;; *) return 1 ;; esac
}

@test "linearly ramps PWM with endpoint clamping" {
	[ "$(linear_ramp_pwm 55 60 80 40 240)" -eq 40 ]
	[ "$(linear_ramp_pwm 70 60 80 40 240)" -eq 140 ]
	[ "$(linear_ramp_pwm 85 60 80 40 240)" -eq 240 ]
	run linear_ramp_pwm 70 80 60 40 240
	[ "$status" -ne 0 ]
}

@test "target-drive feed-forward blends into its response ramp continuously" {
	[ "$(target_drive_pwm 64 90 15 10 0 51 255)" -eq 0 ]
	[ "$(target_drive_pwm 65 90 15 10 0 51 255)" -eq 0 ]
	[ "$(target_drive_pwm 74 90 15 10 0 51 255)" -eq 45 ]
	[ "$(target_drive_pwm 75 90 15 10 0 51 255)" -eq 51 ]
	[ "$(target_drive_pwm 90 90 15 10 0 51 255)" -eq 255 ]
	[ "$(target_drive_pwm 3 80 75 10 0 51 255)" -eq 30 ]
	[ "$(target_drive_pwm -1 80 80 5 0 51 255)" -eq 0 ]
	[ "$(target_drive_pwm 0 80 80 5 0 51 255)" -eq 51 ]
	[ "$(target_drive_pwm 80 80 80 5 0 51 255)" -eq 255 ]
	run target_drive_pwm 20 90 14 5 0 51 255
	[ "$status" -ne 0 ]
	run target_drive_pwm 20 80 90 5 0 51 255
	[ "$status" -ne 0 ]
	run target_drive_pwm 20 90 15 1 0 51 255
	[ "$status" -ne 0 ]
	run target_drive_pwm 20 90 15 11 0 51 255
	[ "$status" -ne 0 ]
}

@test "bounded PI limits correction and anti-windup at saturation" {
	[ "$(bounded_pi_step 5000 0 2 10000 1000 10000000 255)" = "50|10000" ]
	[ "$(bounded_pi_step -5000 0 2 10000 1000 10000000 255)" = "-50|-10000" ]
	[ "$(bounded_pi_step 190000 0 10 1000000 1000000 100000000 40)" = "40|0" ]
	[ "$(bounded_pi_step 10000 2000 2 1000 1000000 10000000 20)" = "12|2000" ]
	[ "$(bounded_pi_step -10000 -2000 2 1000 1000000 10000000 20)" = "-12|-2000" ]
	run bounded_pi_step bad 0 2 10000 1000 10000000 255
	[ "$status" -ne 0 ]
}

@test "target-drive composition freezes and anti-winds up its integral" {
	[ "$(target_drive_step 200 5000 0 2 10000 0 10000000 255 0 255 0)" = "250|10000|50" ]
	[ "$(target_drive_step 200 5000 1234 2 10000 0 10000000 255 0 255 1)" = "250|1234|50" ]
	[ "$(target_drive_step 240 5000 100 2 10000 1000000 10000000 255 0 255 0)" = "255|100|50" ]
	[ "$(target_drive_step 10 -5000 100 2 10000 1000000 10000000 255 51 255 0)" = "51|100|-50" ]
	run target_drive_step 200 5000 0 2 10000 0 10000000 255 0 255 2
	[ "$status" -ne 0 ]
}

@test "target-drive preserves a stop request with a configured running floor" {
	[ "$(target_drive_step 0 5000 3000 2 10000 1000000 10000000 255 51 255)" = "0|3000|0" ]
	[ "$(target_drive_step 10 0 0 2 10000 0 10000000 255 51 255)" = "51|0|0" ]
}

@test "global protection boosts once, ramps, locks, and releases with hysteresis" {
	[ "$(global_protection_step 74 90 15 5 51 0 0)" = "51|0|0|0|0" ]
	[ "$(global_protection_step 75 90 15 5 51 0 0)" = "51|0|1|1|0" ]
	[ "$(global_protection_step 75 90 15 5 51 0 1)" = "51|0|1|0|0" ]
	[ "$(global_protection_step 80 90 15 5 51 0 1)" = "119|0|1|0|0" ]
	[ "$(global_protection_step 90 90 15 5 51 0 1)" = "255|1|1|0|1" ]
	[ "$(global_protection_step 89 90 15 5 51 1 1)" = "255|1|1|0|0" ]
	[ "$(global_protection_step 85 90 15 5 51 1 1)" = "187|0|1|0|0" ]
	[ "$(global_protection_step 100 100 15 2 0 0 0)" = "255|1|1|1|1" ]
	[ "$(global_protection_step 88 90 15 2 51 1 1)" = "227|0|1|0|0" ]
	[ "$(global_protection_step 88 90 15 2 51 1 0)" = "227|0|1|1|0" ]
	run global_protection_step 80 90 14 5 51 0 0
	[ "$status" -ne 0 ]
	run global_protection_step 80 90 15 1 51 0 0
	[ "$status" -ne 0 ]
	run global_protection_step 80 90 15 5 51 2 0
	[ "$status" -ne 0 ]
}

@test "offline dispatch keeps stop and running floor distinct and signals startup" {
	[ "$(protection_dispatch_step 0 74 90 15 5 51 0 0 0 0)" = "0|mode|0|0|0|0" ]
	[ "$(protection_dispatch_step 10 74 90 15 5 51 0 0 0 0)" = "51|mode|0|0|1|0" ]
	[ "$(protection_dispatch_step 51 75 90 15 5 51 51 0 0 0)" = "51|protection_ramp|0|1|1|0" ]
	[ "$(protection_dispatch_step 0 75 90 15 5 51 0 0 0 0)" = "51|protection_ramp|0|1|1|0" ]
	[ "$(protection_dispatch_step 0 76 90 15 5 51 51 0 1 0)" = "51|protection_ramp|0|1|0|0" ]
	[ "$(protection_dispatch_step 0 75 90 15 5 0 0 0 0 0)" = "0|protection_ramp|0|1|1|0" ]
	[ "$(protection_dispatch_step 0 76 90 15 5 0 0 0 1 0)" = "17|protection_ramp|0|1|0|0" ]
}

@test "offline dispatch overrides off, counts once per lock, and releases at the boundary" {
	lock=$(protection_dispatch_step 0 90 90 15 5 51 0 0 0 0)
	[ "$lock" = "255|protection_lock|1|1|0|1" ]
	IFS='|' read -r pwm _ locked active _ count <<EOF
$lock
EOF
	held=$(protection_dispatch_step 0 86 90 15 5 51 "$pwm" "$locked" "$active" "$count")
	[ "$held" = "255|protection_lock|1|1|0|1" ]
	IFS='|' read -r pwm _ locked active _ count <<EOF
$held
EOF
	released=$(protection_dispatch_step 0 85 90 15 5 51 "$pwm" "$locked" "$active" "$count")
	[ "$released" = "170|protection_ramp|0|1|0|1" ]
	IFS='|' read -r pwm _ locked active _ count <<EOF
$released
EOF
	[ "$(protection_dispatch_step 0 90 90 15 5 51 "$pwm" "$locked" "$active" "$count")" = "255|protection_lock|1|1|0|2" ]
}

@test "offline dispatch requests full speed on faults without inventing a heat event" {
	[ "$(protection_dispatch_step 0 bad 90 15 5 51 255 1 1 8)" = "255|invalid_sensor|1|1|0|8" ]
	[ "$(protection_dispatch_step bad 90 90 15 5 51 0 0 0 8)" = "255|invalid_control|0|0|0|8" ]
	[ "$(protection_dispatch_step 0 90 90 15 1 51 0 0 0 8)" = "255|invalid_control|0|0|0|8" ]
	run protection_dispatch_step 0 90 90 15 5 51 0 1 0 8
	[ "$status" -ne 0 ]
}

@test "target drive and protection compose when their thresholds are equal" {
	# Use a target-mode cap below full speed to distinguish the two requests.
	feedforward=$(target_drive_pwm 90 90 15 5 0 51 200)
	mode=$(target_drive_step "$feedforward" 0 2000 2 1000 1000000 10000000 30 51 200)
	[ "${mode%%|*}" = 200 ]
	protection=$(protection_dispatch_step "${mode%%|*}" 90 90 15 5 51 170 0 1 0)
	[ "$protection" = "255|protection_lock|1|1|0|1" ]

	# A cooler control sensor must not lower the protected safety request.
	feedforward=$(target_drive_pwm 85 90 15 5 0 51 200)
	mode=$(target_drive_step "$feedforward" -5000 2000 2 1000 1000000 10000000 30 51 200 1)
	[ "$mode" = "147|2000|-3" ]
	[ "$(protection_dispatch_step "${mode%%|*}" 86 90 15 5 51 255 1 1 1)" = "255|protection_lock|1|1|0|1" ]
	[ "$(protection_dispatch_step "${mode%%|*}" 85 90 15 5 51 255 1 1 1)" = "219|protection_ramp|0|1|0|1" ]

	# Once the safety sensor leaves the acceleration range, mode control resumes.
	feedforward=$(target_drive_pwm 74 90 15 5 0 51 200)
	mode=$(target_drive_step "$feedforward" -16000 2000 2 1000 1000000 10000000 30 51 200 1)
	[ "$mode" = "51|2000|-14" ]
	[ "$(protection_dispatch_step "${mode%%|*}" 74 90 15 5 51 219 0 1 1)" = "51|mode|0|0|0|1" ]

	# After release, resume from the retained integral with one normal sample.
	feedforward=$(target_drive_pwm 74 90 15 5 51 90 200)
	mode=$(target_drive_step "$feedforward" -16000 2000 2 1000 100000 10000000 30 51 200)
	[ "$mode" = "63|-30000|-19" ]
	[ "$(protection_dispatch_step "${mode%%|*}" 74 90 15 5 51 51 0 0 1)" = "63|mode|0|0|0|1" ]
}

@test "protection history updates a cycle peak and expires old events from the 24-hour count" {
	newline='
'
	first=$(protection_dispatch_step 0 90 90 15 5 51 0 0 0 0)
	result=$(protection_history_step 100000 90 0 "$first" '')
	[ "$result" = "1|1|100000|90
100000|90" ]
	held=$(protection_dispatch_step 0 94 90 15 5 51 255 1 1 1)
	result=$(protection_history_step 100010 94 1 "$held" "${result#*"$newline"}")
	[ "$result" = "1|1|100000|94
100000|94" ]

	# After a release and new lock exactly 24 hours later, the first event
	# remains in the cumulative count only.
	relock=$(protection_dispatch_step 0 91 90 15 5 51 0 0 0 1)
	result=$(protection_history_step 186400 91 0 "$relock" "${result#*"$newline"}")
	[ "$result" = "1|2|186400|91
186400|91" ]
	fault=$(protection_dispatch_step 0 bad 90 15 5 51 255 1 1 2)
	result=$(protection_history_step 272800 bad 1 "$fault" "${result#*"$newline"}")
	[ "$result" = "0|2|186400|91
186400|91" ]
}

@test "protection history keeps multiple recent cycles and rejects invalid stored rows" {
	previous='100000|94
110000|91'
	dispatch=$(protection_dispatch_step 0 93 90 15 5 51 0 0 0 7)
	[ "$(protection_history_step 120000 93 0 "$dispatch" "$previous")" = "3|8|120000|93
100000|94
110000|91
120000|93" ]
	run protection_history_step 120000 93 0 "$dispatch" '120001|92'
	[ "$status" -ne 0 ]
	run protection_history_step 120000 93 0 "$dispatch" '110000|bad'
	[ "$status" -ne 0 ]
}

@test "protected target cycle freezes integration through the ramp and resumes on exit" {
	[ "$(protected_target_step 120 -5000 2000 2 1000 1000000 10000000 30 51 200 75 90 15 5 120 0 0 0)" = \
		"117|protection_ramp|0|1|1|0|2000|-3" ]
	# The safety sensor can cross the protection threshold while the control
	# sensor still requests a lower output. No freeze flag is supplied.
	[ "$(protected_target_step 120 -5000 2000 2 1000 1000000 10000000 30 51 200 90 90 15 5 120 0 1 0)" = \
		"255|protection_lock|1|1|0|1|2000|-3" ]
	[ "$(protected_target_step 150 -5000 2000 2 1000 1000000 10000000 30 51 200 85 90 15 5 255 1 1 1)" = \
		"219|protection_ramp|0|1|0|1|2000|-3" ]
	[ "$(protected_target_step 82 -16000 2000 2 1000 100000 10000000 30 51 200 74 90 15 5 219 0 1 1)" = \
		"63|mode|0|0|0|1|-30000|-19" ]
}

@test "protected target cycle sends faults to full speed and preserves PI state" {
	[ "$(protected_target_step 120 -5000 2000 2 1000 1000000 10000000 30 51 200 bad 90 15 5 255 1 1 4)" = \
		"255|invalid_sensor|1|1|0|4|2000|0" ]
	[ "$(protected_target_step 120 bad 2000 2 1000 1000000 10000000 30 51 200 74 90 15 5 120 0 0 4)" = \
		"255|invalid_control|0|0|0|4|2000|0" ]
}

@test "history snapshot restores an active cycle after restart and ages the 24-hour count" {
	file="$BATS_TEST_TMPDIR/protection-history"
	[ "$(protection_history_load "$file" 100000)" = '0|0|0|--|--' ]
	first=$(protection_dispatch_step 0 90 90 15 5 51 0 0 0 0)
	[ "$(protection_history_save_step "$file" 100000 90 "$first")" = '1|1|100000|90' ]
	[ "$(stat -c %a "$file")" = 600 ]
	# Load the state in a fresh shell with no in-memory lock or counter.
	run sh -c '. "$1"; protection_history_load "$2" 100010' sh "$BATS_TEST_DIRNAME/../root/usr/lib/h5000m-pwmfan/controller-lib.sh" "$file"
	[ "$status" -eq 0 ]
	[ "$output" = '1|1|1|100000|90
100000|90' ]
	held=$(protection_dispatch_step 0 97 90 15 5 51 255 1 1 1)
	[ "$(protection_history_save_step "$file" 100010 97 "$held")" = '1|1|100000|97' ]
	[ "$(protection_history_load "$file" 186400)" = '1|0|1|100000|97
100000|97' ]
	released=$(protection_dispatch_step 0 85 90 15 5 51 255 1 1 1)
	[ "$(protection_history_save_step "$file" 186400 85 "$released")" = '0|1|100000|97' ]
	relock=$(protection_dispatch_step 0 91 90 15 5 51 200 0 1 1)
	[ "$(protection_history_save_step "$file" 186401 91 "$relock")" = '1|2|186401|91' ]
	[ "$(protection_history_load "$file" 186401)" = '1|1|2|186401|91
186401|91' ]
}

@test "history snapshot preserves the previous file on stale dispatch and clock rollback" {
	file="$BATS_TEST_TMPDIR/protection-history"
	printf '%s\n' 'v1|1|1' '100000|93' >"$file"
	before=$(cat "$file")
	run protection_history_save_step "$file" 100010 95 '255|protection_lock|1|1|0|2'
	[ "$status" -ne 0 ]
	run protection_history_save_step "$file" 99999 95 '255|protection_lock|1|1|0|1'
	[ "$status" -ne 0 ]
	[ "$(cat "$file")" = "$before" ]

	# Simulate a failed atomic replacement without relying on runner permissions.
	mv() { return 1; }
	run protection_history_save_step "$file" 100010 95 '255|protection_lock|1|1|0|1'
	[ "$status" -ne 0 ]
	[ "$(cat "$file")" = "$before" ]
	set -- "$file".*
	[ "$1" = "$file.*" ]
}

@test "history snapshot rejects malformed persisted state without resetting counters" {
	file="$BATS_TEST_TMPDIR/protection-history"
	for broken in 'v1|1|08' 'v1|1|0' 'v1|1|1|' 'v2|1|1'; do
		printf '%s\n' "$broken" '100000|93' >"$file"
		before=$(cat "$file")
		run protection_history_save_step "$file" 100010 95 '255|protection_lock|1|1|0|1'
		[ "$status" -ne 0 ]
		[ "$(cat "$file")" = "$before" ]
	done
}

@test "status command reads history when available and preserves fan status when it is damaged" {
	runtime_dir=$BATS_TEST_TMPDIR
	status_command="$runtime_dir/status-command"
	history_file="$runtime_dir/protection-history"
	lib="$BATS_TEST_DIRNAME/../root/usr/lib/h5000m-pwmfan/controller-lib.sh"
	# Route the installed entry point to an isolated status directory and library.
	sed -e "s|^\. /usr/lib/h5000m-pwmfan/controller-lib.sh$|. '$lib'|" \
		-e "s|^runtime_dir=/var/run/h5000m-pwmfan$|runtime_dir='$runtime_dir'|" \
		"$BATS_TEST_DIRNAME/../root/usr/sbin/h5000m-pwmfan-status" >"$status_command"
	printf '%s\n' 'state=running' >"$runtime_dir/status"
	run sh "$status_command"
	[ "$status" -eq 0 ]
	printf '%s\n' "$output" | grep -Fxq 'state=running'
	printf '%s\n' "$output" | grep -Fxq 'protection_history_state=missing'

	now=$(date +%s)
	printf 'v1|0|2\n%s|95\n' "$((now - 30))" >"$history_file"
	run sh "$status_command"
	[ "$status" -eq 0 ]
	printf '%s\n' "$output" | grep -Fxq 'protection_history_state=available'
	printf '%s\n' "$output" | grep -Fxq 'protection_locked=0'
	printf '%s\n' "$output" | grep -Fxq 'protection_count_24h=1'
	printf '%s\n' "$output" | grep -Fxq 'protection_count_total=2'
	printf '%s\n' "$output" | grep -Fxq "protection_last_trigger=$((now - 30))"
	printf '%s\n' "$output" | grep -Fxq 'protection_last_cycle_peak_c=95'

	printf 'bad\n' >"$history_file"
	run sh "$status_command"
	[ "$status" -eq 0 ]
	printf '%s\n' "$output" | grep -Fxq 'state=running'
	printf '%s\n' "$output" | grep -Fxq 'protection_history_state=unavailable'
}
