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
	run bounded_pi_step bad 0 2 10000 1000 10000000 255
	[ "$status" -ne 0 ]
}

@test "global protection boosts once, ramps, locks, and releases with hysteresis" {
	[ "$(global_protection_step 74 90 15 5 51 0 0)" = "51|0|0|0|0" ]
	[ "$(global_protection_step 75 90 15 5 51 0 0)" = "51|0|1|1|0" ]
	[ "$(global_protection_step 75 90 15 5 51 0 1)" = "51|0|1|0|0" ]
	[ "$(global_protection_step 80 90 15 5 51 0 1)" = "119|0|1|0|0" ]
	[ "$(global_protection_step 90 90 15 5 51 0 1)" = "255|1|1|0|1" ]
	[ "$(global_protection_step 89 90 15 5 51 1 1)" = "255|1|1|0|0" ]
	[ "$(global_protection_step 85 90 15 5 51 1 1)" = "187|0|1|0|0" ]
	run global_protection_step 80 90 14 5 51 0 0
	[ "$status" -ne 0 ]
}
