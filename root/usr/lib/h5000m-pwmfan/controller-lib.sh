#!/bin/sh

is_uint() {
	case "$1" in
	'' | *[!0-9]*) return 1 ;;
	*) return 0 ;;
	esac
}

in_range() {
	is_uint "$1" || return 1
	[ "$1" -ge "$2" ] 2>/dev/null && [ "$1" -le "$3" ] 2>/dev/null
}

valid_temp_mc() {
	case "$1" in '' | *[!0-9-]*) return 1 ;; esac
	case "$1" in -*-) return 1 ;; esac
	[ "$1" -ge -40000 ] 2>/dev/null && [ "$1" -le 150000 ] 2>/dev/null
}

valid_temp_c() {
	case "$1" in '' | *[!0-9-]*) return 1 ;; esac
	case "$1" in -*-) return 1 ;; esac
	[ "$1" -ge -40 ] 2>/dev/null && [ "$1" -le 150 ] 2>/dev/null
}

modem_throttle_pwm() {
	case "$1" in
	0) printf '0\n' ;;
	1) printf '128\n' ;;
	2) printf '192\n' ;;
	3) printf '255\n' ;;
	*) return 1 ;;
	esac
}

sensor_selected() {
	[ "$SENSOR_SELECTION" = auto ] && return 0
	case " $SENSOR_SELECTION " in *" $1 "*) return 0 ;; esac
	return 1
}

record_sensor() {
	id=$1
	label=$2
	value=$3
	state=$4
	if [ "$state" = ok ] && valid_temp_mc "$value"; then
		if [ -z "$SAFETY_TEMP_MC" ] || [ "$value" -gt "$SAFETY_TEMP_MC" ]; then
			SAFETY_TEMP_MC=$value
			# shellcheck disable=SC2034
			SAFETY_SOURCE=$id
		fi
		if sensor_selected "$id"; then
			if [ -z "$CONTROL_TEMP_MC" ] || [ "$value" -gt "$CONTROL_TEMP_MC" ]; then
				CONTROL_TEMP_MC=$value
				# shellcheck disable=SC2034
				CONTROL_SOURCE=$id
			fi
		else
			state=unselected
		fi
	else
		value=--
	fi
	SENSOR_STATUS="${SENSOR_STATUS}${SENSOR_STATUS:+;}${id}|${label}|${value}|${state}"
}

curve_validate() {
	curve=$1
	old_ifs=$IFS
	IFS=,
	# Intentional splitting: each comma-delimited point becomes one argument.
	# shellcheck disable=SC2086
	set -- $curve
	IFS=$old_ifs
	[ "$#" -ge 2 ] || return 1
	previous_temp=-1
	for point; do
		case "$point" in *:*) ;; *) return 1 ;; esac
		temp=${point%%:*}
		pwm=${point#*:}
		case "$pwm" in *:*) return 1 ;; esac
		in_range "$temp" 0 150 || return 1
		in_range "$pwm" 0 255 || return 1
		[ "$temp" -gt "$previous_temp" ] || return 1
		previous_temp=$temp
	done
}

curve_value() {
	curve=$1
	target_temp=$2
	is_uint "$target_temp" || return 1
	curve_validate "$curve" || return 1
	old_ifs=$IFS
	IFS=,
	# Intentional splitting: each comma-delimited point becomes one argument.
	# shellcheck disable=SC2086
	set -- $curve
	IFS=$old_ifs
	first=$1
	first_temp=${first%%:*}
	first_pwm=${first#*:}
	[ "$target_temp" -le "$first_temp" ] && {
		printf '%s\n' "$first_pwm"
		return
	}
	previous_temp=$first_temp
	previous_pwm=$first_pwm
	shift
	for point; do
		temp=${point%%:*}
		pwm=${point#*:}
		if [ "$target_temp" -le "$temp" ]; then
			delta_temp=$((temp - previous_temp))
			delta_pwm=$((pwm - previous_pwm))
			value=$((previous_pwm + (target_temp - previous_temp) * delta_pwm / delta_temp))
			printf '%s\n' "$value"
			return 0
		fi
		previous_temp=$temp
		previous_pwm=$pwm
	done
	printf '%s\n' "$previous_pwm"
}

clamp_pwm() {
	value=$1
	minimum=$2
	maximum=$3
	in_range "$value" 0 255 || return 1
	in_range "$minimum" 0 255 || return 1
	in_range "$maximum" 0 255 || return 1
	[ "$minimum" -le "$maximum" ] || return 1
	[ "$value" -lt "$minimum" ] && value=$minimum
	[ "$value" -gt "$maximum" ] && value=$maximum
	printf '%s\n' "$value"
}
