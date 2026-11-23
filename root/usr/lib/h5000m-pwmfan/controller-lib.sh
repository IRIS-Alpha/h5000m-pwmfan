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
	# Match the runtime id or the stable sysfs label: hwmon numbering can move between boots.
	case " $SENSOR_SELECTION " in *" $1 "* | *" $2 "*) return 0 ;; esac
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
		if sensor_selected "$id" "$label"; then
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

curve_validate() (
	curve=$1
	minimum=${2:-0}
	maximum=${3:-255}
	point_count=${4:-0}
	maximum_temp=${5:-150}
	set -f
	case "$curve" in ,* | *, | *,,*) return 1 ;; esac
	old_ifs=$IFS
	IFS=,
	# Intentional splitting: each comma-delimited point becomes one argument.
	# shellcheck disable=SC2086
	set -- $curve
	IFS=$old_ifs
	[ "$#" -ge 2 ] || return 1
	[ "$point_count" -eq 0 ] || [ "$#" -eq "$point_count" ] || return 1
	previous_temp=-1
	previous_pwm=0
	for point; do
		case "$point" in *:*) ;; *) return 1 ;; esac
		temp=${point%%:*}
		pwm=${point#*:}
		case "$pwm" in *:*) return 1 ;; esac
		case "$temp:$pwm" in 0[0-9]*:* | *:0[0-9]*) return 1 ;; esac
		in_range "$temp" 0 "$maximum_temp" || return 1
		in_range "$pwm" "$previous_pwm" "$maximum" || return 1
		[ "$pwm" -eq 0 ] || [ "$pwm" -ge "$minimum" ] || return 1
		[ "$temp" -gt "$previous_temp" ] || return 1
		previous_temp=$temp
		previous_pwm=$pwm
	done
)

curve_value() {
	curve=$1
	target_temp=$2
	valid_temp_c "$target_temp" || return 1
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

is_signed_int() {
	case "$1" in
	'' | -) return 1 ;;
	-*)
		digits=${1#-}
		case "$digits" in '' | *[!0-9]*) return 1 ;; esac
		;;
	*[!0-9]*) return 1 ;;
	esac
	return 0
}

linear_ramp_pwm() {
	temperature=$1
	start_temp=$2
	end_temp=$3
	start_pwm=$4
	end_pwm=$5
	valid_temp_c "$temperature" && valid_temp_c "$start_temp" && valid_temp_c "$end_temp" || return 1
	in_range "$start_pwm" 0 255 && in_range "$end_pwm" "$start_pwm" 255 || return 1
	[ "$start_temp" -lt "$end_temp" ] || return 1
	if [ "$temperature" -le "$start_temp" ]; then
		printf '%s\n' "$start_pwm"
	elif [ "$temperature" -ge "$end_temp" ]; then
		printf '%s\n' "$end_pwm"
	else
		printf '%s\n' "$((start_pwm + (temperature - start_temp) * (end_pwm - start_pwm) / (end_temp - start_temp)))"
	fi
}

target_drive_pwm() {
	temperature=$1
	target_temp=$2
	response_radius=$3
	blend_width=$4
	idle_pwm=$5
	response_pwm=$6
	maximum_pwm=$7
	valid_temp_c "$temperature" || return 1
	in_range "$target_temp" 80 100 || return 1
	in_range "$response_radius" 15 "$target_temp" || return 1
	in_range "$blend_width" 2 10 || return 1
	in_range "$idle_pwm" 0 255 && in_range "$response_pwm" "$idle_pwm" 255 && in_range "$maximum_pwm" "$response_pwm" 255 || return 1
	response_start=$((target_temp - response_radius))
	effective_blend=$blend_width
	[ "$effective_blend" -le "$response_start" ] || effective_blend=$response_start
	if [ "$effective_blend" -eq 0 ]; then
		if [ "$temperature" -lt "$response_start" ]; then
			printf '%s\n' "$idle_pwm"
		elif [ "$temperature" -eq "$response_start" ]; then
			printf '%s\n' "$response_pwm"
		else
			linear_ramp_pwm "$temperature" "$response_start" "$target_temp" "$response_pwm" "$maximum_pwm"
		fi
	elif [ "$temperature" -le "$response_start" ]; then
		blend_start=$((response_start - effective_blend))
		linear_ramp_pwm "$temperature" "$blend_start" "$response_start" "$idle_pwm" "$response_pwm"
	else
		linear_ramp_pwm "$temperature" "$response_start" "$target_temp" "$response_pwm" "$maximum_pwm"
	fi
}

bounded_pi_step() {
	error_mc=$1
	integral_mc_s=$2
	delta_seconds=$3
	kp_milli=$4
	ki_milli=$5
	integral_limit=$6
	correction_limit=$7
	freeze_integral=${8:-0}
	is_signed_int "$error_mc" && is_signed_int "$integral_mc_s" || return 1
	in_range "$delta_seconds" 1 30 || return 1
	[ "$error_mc" -ge -190000 ] && [ "$error_mc" -le 190000 ] || return 1
	in_range "$kp_milli" 0 1000000 && in_range "$ki_milli" 0 1000000 || return 1
	in_range "$integral_limit" 1 100000000 && in_range "$correction_limit" 0 255 || return 1
	case "$freeze_integral" in 0 | 1) ;; *) return 1 ;; esac
	[ "$integral_mc_s" -ge "$((0 - integral_limit))" ] && [ "$integral_mc_s" -le "$integral_limit" ] || return 1
	if [ "$freeze_integral" = 1 ]; then
		new_integral=$integral_mc_s
	else
		new_integral=$((integral_mc_s + error_mc * delta_seconds))
		[ "$new_integral" -lt "$((0 - integral_limit))" ] && new_integral=$((0 - integral_limit))
		[ "$new_integral" -gt "$integral_limit" ] && new_integral=$integral_limit
	fi
	proportional=$((error_mc * kp_milli / 1000000))
	integral=$((new_integral * ki_milli / 1000000000))
	correction=$((proportional + integral))
	negative_limit=$((0 - correction_limit))
	if { [ "$correction" -gt "$correction_limit" ] && [ "$error_mc" -gt 0 ]; } ||
		{ [ "$correction" -lt "$negative_limit" ] && [ "$error_mc" -lt 0 ]; }; then
		new_integral=$integral_mc_s
		correction=$((proportional + new_integral * ki_milli / 1000000000))
	fi
	[ "$correction" -gt "$correction_limit" ] && correction=$correction_limit
	[ "$correction" -lt "$negative_limit" ] && correction=$negative_limit
	printf '%s|%s\n' "$correction" "$new_integral"
}

target_drive_step() {
	feedforward_pwm=$1
	error_mc=$2
	integral_mc_s=$3
	delta_seconds=$4
	kp_milli=$5
	ki_milli=$6
	integral_limit=$7
	correction_limit=$8
	minimum_pwm=$9
	maximum_pwm=${10}
	freeze_integral=${11:-0}
	in_range "$feedforward_pwm" 0 255 && in_range "$minimum_pwm" 0 255 && in_range "$maximum_pwm" 1 255 || return 1
	[ "$minimum_pwm" -le "$maximum_pwm" ] || return 1
	case "$freeze_integral" in 0 | 1) ;; *) return 1 ;; esac
	# The feed-forward stop zone takes precedence over PI and the running floor.
	[ "$feedforward_pwm" -eq 0 ] && freeze_integral=1
	result=$(bounded_pi_step "$error_mc" "$integral_mc_s" "$delta_seconds" "$kp_milli" "$ki_milli" "$integral_limit" "$correction_limit" "$freeze_integral") || return 1
	correction=${result%%|*}
	next_integral=${result#*|}
	if [ "$feedforward_pwm" -eq 0 ]; then
		printf '0|%s|0\n' "$next_integral"
		return 0
	fi
	requested=$((feedforward_pwm + correction))
	if [ "$freeze_integral" = 0 ] && { { [ "$requested" -gt "$maximum_pwm" ] && [ "$error_mc" -gt 0 ]; } || { [ "$requested" -lt "$minimum_pwm" ] && [ "$error_mc" -lt 0 ]; }; }; then
		result=$(bounded_pi_step "$error_mc" "$integral_mc_s" "$delta_seconds" "$kp_milli" "$ki_milli" "$integral_limit" "$correction_limit" 1) || return 1
		correction=${result%%|*}
		next_integral=${result#*|}
		requested=$((feedforward_pwm + correction))
	fi
	pwm=$requested
	[ "$pwm" -lt "$minimum_pwm" ] && pwm=$minimum_pwm
	[ "$pwm" -gt "$maximum_pwm" ] && pwm=$maximum_pwm
	printf '%s|%s|%s\n' "$pwm" "$next_integral" "$correction"
}

global_protection_step() {
	temperature=$1
	threshold=$2
	acceleration_radius=$3
	release_hysteresis=$4
	base_pwm=$5
	was_locked=$6
	was_active=$7
	valid_temp_c "$temperature" || return 1
	in_range "$threshold" 80 100 || return 1
	in_range "$acceleration_radius" 15 140 || return 1
	in_range "$release_hysteresis" 2 100 || return 1
	in_range "$base_pwm" 0 255 || return 1
	case "$was_locked:$was_active" in 0:0 | 0:1 | 1:0 | 1:1) ;; *) return 1 ;; esac
	start_temp=$((threshold - acceleration_radius))
	[ "$start_temp" -ge -40 ] || return 1
	locked=$was_locked
	lock_event=0
	if [ "$locked" = 1 ] && [ "$temperature" -le "$((threshold - release_hysteresis))" ]; then locked=0; fi
	if [ "$locked" = 0 ] && [ "$temperature" -ge "$threshold" ]; then
		locked=1
		lock_event=1
	fi
	active=0
	boost=0
	if [ "$temperature" -ge "$start_temp" ] || [ "$locked" = 1 ]; then
		active=1
		[ "$was_active" = 1 ] || boost=1
	fi
	if [ "$locked" = 1 ]; then
		pwm=255
	elif [ "$active" = 1 ]; then
		pwm=$(linear_ramp_pwm "$temperature" "$start_temp" "$threshold" "$base_pwm" 255) || return 1
	else
		pwm=$base_pwm
	fi
	printf '%s|%s|%s|%s|%s\n' "$pwm" "$locked" "$active" "$boost" "$lock_event"
}

# Decide the PWM request for one offline cycle, given the current mode request
# and the prior protection state. Return pwm|reason|locked|active|boost|count.
# The caller applies any boost and stores the returned state after the cycle.
# A rejected prior state must be handled as a control fault by the caller.
protection_dispatch_step() (
	mode_pwm=$1
	safety_temp=$2
	threshold=$3
	radius=$4
	release=$5
	running_min=$6
	previous_pwm=$7
	was_locked=$8
	was_active=$9
	count=${10}
	case "$was_locked:$was_active" in 0:0 | 0:1 | 1:1) ;; *) return 1 ;; esac
	in_range "$count" 0 2147483647 || return 1

	if ! valid_temp_c "$safety_temp"; then
		printf '255|invalid_sensor|%s|%s|0|%s\n' "$was_locked" "$was_active" "$count"
		return 0
	fi
	if ! in_range "$mode_pwm" 0 255 || ! in_range "$running_min" 0 255 || ! in_range "$previous_pwm" 0 255 ||
		! protection=$(global_protection_step "$safety_temp" "$threshold" "$radius" "$release" "$mode_pwm" "$was_locked" "$was_active"); then
		printf '255|invalid_control|%s|%s|0|%s\n' "$was_locked" "$was_active" "$count"
		return 0
	fi
	IFS='|' read -r pwm locked active boost lock_event <<EOF
$protection
EOF

	reason=mode
	if [ "$locked" = 1 ]; then
		reason=protection_lock
		# The locked output is already full speed. Request it immediately.
		boost=0
	elif [ "$boost" = 1 ] || [ "$pwm" -gt "$mode_pwm" ]; then
		reason=protection_ramp
	fi
	if [ "$pwm" -gt 0 ] || [ "$active" = 1 ]; then
		[ "$pwm" -ge "$running_min" ] || pwm=$running_min
	fi
	# Protection already signals its own boost on entry, even at a 0% floor.
	if [ "$active" = 0 ] && [ "$pwm" -gt 0 ] && [ "$previous_pwm" -eq 0 ]; then
		boost=1
	fi
	if [ "$lock_event" = 1 ] && [ "$count" -lt 2147483647 ]; then
		# Strip leading zeros so shell arithmetic treats the counter as decimal.
		count=${count#"${count%%[!0]*}"}
		count=$((${count:-0} + 1))
	fi
	printf '%s|%s|%s|%s|%s|%s\n' "$pwm" "$reason" "$locked" "$active" "$boost" "$count"
)

# Record a protection dispatch result in a timestamp|peak_c history. The caller
# passes the previous lock state and the rows from the prior result. The first
# output line is count_24h|cumulative_count|last_trigger|last_cycle_peak.
protection_history_step() (
	now=$1
	safety_temp=$2
	was_locked=$3
	dispatch=$4
	history=$5
	in_range "$now" 0 9999999999 || return 1
	case "$was_locked" in 0 | 1) ;; *) return 1 ;; esac
	IFS='|' read -r _ reason locked _ _ count <<EOF
$dispatch
EOF
	in_range "$count" 0 2147483647 || return 1
	case "$reason:$locked" in
	protection_lock:1) valid_temp_c "$safety_temp" || return 1 ;;
	mode:0 | protection_ramp:0 | invalid_sensor:0 | invalid_sensor:1 | invalid_control:0 | invalid_control:1) safety_temp=0 ;;
	*) return 1 ;;
	esac

	printf '%s\n' "$history" | awk -F '|' -v now="$now" -v temp="$safety_temp" \
		-v update="$reason" -v prior="$was_locked" -v total="$count" '
		BEGIN { now += 0 }
		NF == 0 && NR == 1 { next }
		NF != 2 || $1 !~ /^[0-9]+$/ || $2 !~ /^-?[0-9]+$/ ||
			$1 + 0 > now || (seen && $1 + 0 < last) || $2 + 0 < -40 || $2 + 0 > 150 {
			invalid = 1
			exit 1
		}
		{
			# Hold the newest row separately so its peak can be updated.
			if (seen) retain_recent(last, peak)
			last = $1 + 0
			peak = $2 + 0
			seen = 1
		}
		function retain_recent(timestamp, temperature) {
			if (timestamp > now - 86400) {
				rows = rows sprintf("%.0f|%d\n", timestamp, temperature)
				recent++
			}
		}
		END {
			if (invalid || (prior && !seen)) exit 1
			if (update == "protection_lock") {
				if (!prior) {
					if (seen) retain_recent(last, peak)
					last = now + 0
					peak = temp + 0
					seen = 1
				} else if (temp + 0 > peak) {
					peak = temp + 0
				}
			}
			if (!seen) {
				printf "0|%d|--|--\n", total
				exit
			}
			if (last > now - 86400) recent++
			printf "%d|%d|%.0f|%d\n%s%.0f|%d\n", recent, total, last, peak, rows, last, peak
		}'
)

# Compose one offline target-drive cycle. Feed-forward PWM and elapsed time
# come from the caller. Freeze PI across the full protection window (including
# the ramp after unlock) and faults. Its first unprotected sample uses only
# the caller's current elapsed interval.
# Result: dispatch fields followed by the next integral and PI correction.
protected_target_step() (
	feedforward=$1 error_mc=$2 integral=$3 elapsed=$4 kp=$5 ki=$6
	integral_limit=$7 correction_limit=$8 minimum=$9 maximum=${10}
	shift 10
	safety_temp=$1 threshold=$2 radius=$3 release=$4 previous_pwm=$5
	was_locked=$6 was_active=$7 count=$8
	freeze=0

	# Protection activity is independent of the mode request. Preview its state
	# with a zero request, keeping the original state for the real dispatch.
	preview=$(protection_dispatch_step 0 "$safety_temp" "$threshold" "$radius" "$release" \
		"$minimum" "$previous_pwm" "$was_locked" "$was_active" "$count") || return 1
	IFS='|' read -r _ reason _ active _ <<EOF_PREVIEW
$preview
EOF_PREVIEW
	case "$reason" in
	invalid_sensor | invalid_control)
		printf '%s|%s|0\n' "$preview" "$integral"
		return 0
		;;
	esac
	[ "$active" = 0 ] || freeze=1
	if request=$(target_drive_step "$feedforward" "$error_mc" "$integral" "$elapsed" \
		"$kp" "$ki" "$integral_limit" "$correction_limit" "$minimum" "$maximum" "$freeze"); then
		IFS='|' read -r mode_pwm next_integral correction <<EOF_PI
$request
EOF_PI
	else
		mode_pwm=invalid
		next_integral=$integral
		correction=0
	fi
	dispatch=$(protection_dispatch_step "$mode_pwm" "$safety_temp" "$threshold" "$radius" "$release" \
		"$minimum" "$previous_pwm" "$was_locked" "$was_active" "$count") || return 1
	printf '%s|%s|%s\n' "$dispatch" "$next_integral" "$correction"
)

# Print the stored lock flag and summary, followed by retained timestamp|peak
# rows. Missing files represent a fresh history. Invalid snapshots fail closed
# so a later update cannot replace the existing counters with an empty history.
# A verified, writable PWM channel plus a pwm-fan cooling device are the minimum
# evidence that the kernel handover can be attempted. Args: thermal dir, pwm path,
# kernel_takeover flag, takeover_verified flag.
# Print the thermal zone whose cooling-device bindings include a pwm-fan.
# Args: thermal dir.
thermal_fan_zone() (
	for zone in "$1"/thermal_zone*; do
		[ -r "$zone/temp" ] || continue
		for cdev in "$zone"/cdev[0-9]*; do
			case "${cdev##*/}" in
			*_trip_point | *_weight) continue ;;
			esac
			[ -e "$cdev" ] || continue
			device=$(readlink -f "$cdev" 2>/dev/null) || continue
			[ "$(cat "$device/type" 2>/dev/null)" = "pwm-fan" ] || continue
			echo "$zone"
			exit 0
		done
	done
	exit 1
)

# Print "<temperature> <trip-index>" for every zone trip bound to the pwm-fan,
# coldest first. Args: zone dir.
thermal_fan_trips() (
	zone=$1
	for cdev in "$zone"/cdev[0-9]*; do
		case "${cdev##*/}" in
		*_trip_point | *_weight) continue ;;
		esac
		[ -e "$cdev" ] || continue
		device=$(readlink -f "$cdev" 2>/dev/null) || continue
		[ "$(cat "$device/type" 2>/dev/null)" = "pwm-fan" ] || continue
		index=${cdev##*cdev}
		trip=$(cat "$zone/cdev${index}_trip_point" 2>/dev/null) || continue
		case "$trip" in '' | *[!0-9]*) continue ;; esac
		temp=$(cat "$zone/trip_point_${trip}_temp" 2>/dev/null) || continue
		case "$temp" in '' | *[!0-9]*) continue ;; esac
		printf '%s %s\n' "$temp" "$trip"
	done | sort -n
)

# Pin the two coldest pwm-fan trips so the thermal governor can no longer ask for
# a zero duty or override a configurable over-temperature policy: the coldest is
# held permanently active, the next moves just below the following trip. The
# original temperatures are recorded so the change can be reverted. Args: thermal
# dir, state file.
thermal_takeover_apply() (
	pin_thermal=$1
	pin_state=$2
	[ -e "$pin_state" ] && exit 0
	zone=$(thermal_fan_zone "$pin_thermal") || exit 1
	trips=$(thermal_fan_trips "$zone") || exit 1
	[ "$(printf '%s\n' "$trips" | wc -l)" -ge 3 ] || exit 1
	cold=$(printf '%s\n' "$trips" | sed -n 1p)
	next=$(printf '%s\n' "$trips" | sed -n 2p)
	top=$(printf '%s\n' "$trips" | sed -n 3p)
	cold_temp=${cold% *}
	cold_index=${cold#* }
	next_temp=${next% *}
	next_index=${next#* }
	top_temp=${top% *}
	case "$top_temp" in '' | *[!0-9]*) exit 1 ;; esac
	[ "$top_temp" -gt 2000 ] || exit 1
	printf 'v1 %s %s %s %s\n' "$cold_index" "$cold_temp" "$next_index" "$next_temp" >"$pin_state" || exit 1
	if ! printf '%s\n' "$((top_temp - 1000))" >"$zone/trip_point_${next_index}_temp"; then
		rm -f "$pin_state"
		exit 1
	fi
	if ! printf '%s\n' 1000 >"$zone/trip_point_${cold_index}_temp"; then
		printf '%s\n' "$next_temp" >"$zone/trip_point_${next_index}_temp"
		rm -f "$pin_state"
		exit 1
	fi
	exit 0
)

# Put the pinned trip temperatures back and drop the record. Args: thermal dir,
# state file.
thermal_takeover_restore() (
	[ -f "$2" ] || exit 0
	read -r version cold_index cold_temp next_index next_temp <"$2" || true
	if [ "$version" = "v1" ]; then
		zone=$(thermal_fan_zone "$1") || zone=
		if [ -n "$zone" ]; then
			printf '%s\n' "$next_temp" >"$zone/trip_point_${next_index}_temp" 2>/dev/null || true
			printf '%s\n' "$cold_temp" >"$zone/trip_point_${cold_index}_temp" 2>/dev/null || true
		fi
	fi
	rm -f "$2"
	exit 0
)

thermal_policy_ensure() (
	zone=$(thermal_fan_zone "$1") || exit 1
	policy=$(cat "$zone/policy" 2>/dev/null) || exit 1
	[ "$policy" = "user_space" ] || exit 0
	case " $(cat "$zone/available_policies" 2>/dev/null) " in
	*" step_wise "*) ;;
	*) exit 1 ;;
	esac
	printf '%s\n' step_wise >"$zone/policy" || exit 1
	echo repaired
	exit 0
)

kernel_takeover_ready_dir() (
	thermal_dir=$1
	pwm_path=$2
	[ "$3" = 1 ] && [ "$4" = 1 ] || exit 1
	[ -n "$pwm_path" ] && [ -w "$pwm_path" ] || exit 1
	for cdev in "$thermal_dir"/cooling_device*; do
		[ "$(cat "$cdev/type" 2>/dev/null)" = "pwm-fan" ] && exit 0
	done
	exit 1
)

protection_history_load() (
	file=$1 now=$2
	locked=0 total=0 rows=
	[ ! -L "$file" ] || return 1
	if [ -e "$file" ]; then
		[ -f "$file" ] || return 1
		{
			IFS= read -r header || return 1
			IFS='|' read -r version locked total <<EOF_HEADER
$header
EOF_HEADER
			[ "$header" = "v1|$locked|$total" ] && [ "$version" = v1 ] || return 1
			case "$total" in 0[0-9]*) return 1 ;; esac
			rows=$(cat) || return 1
		} <"$file" || return 1
		if [ -n "$rows" ]; then
			row_count=$(printf '%s\n' "$rows" | wc -l) || return 1
			in_range "$total" "$row_count" 2147483647 || return 1
		else
			[ "$total" = 0 ] || return 1
		fi
	fi
	result=$(protection_history_step "$now" 0 "$locked" "255|invalid_sensor|$locked|$locked|0|$total" "$rows") || return 1
	printf '%s|%s\n' "$locked" "$result"
)

# Save one six-field protection_dispatch_step result from a single writer.
# Return the new history summary on success. A failed write leaves the
# previous snapshot available to readers.
protection_history_save_step() (
	file=$1 now=$2 safety_temp=$3 dispatch=$4
	snapshot=$(protection_history_load "$file" "$now") || return 1
	newline='
'
	if [ "$snapshot" = "${snapshot%%"$newline"*}" ]; then
		rows=
	else
		rows=${snapshot#*"$newline"}
	fi
	IFS='|' read -r was_locked _ prior_total _ _ <<EOF_STORED
${snapshot%%"$newline"*}
EOF_STORED
	IFS='|' read -r _ reason locked _ _ total <<EOF_DISPATCH
$dispatch
EOF_DISPATCH
	expected_total=$prior_total
	if [ "$reason" = protection_lock ] && [ "$was_locked" = 0 ] && [ "$prior_total" -lt 2147483647 ]; then
		expected_total=$((prior_total + 1))
	fi
	[ "$total" = "$expected_total" ] || return 1
	case "$reason" in
	invalid_sensor | invalid_control) [ "$locked" = "$was_locked" ] || return 1 ;;
	esac
	result=$(protection_history_step "$now" "$safety_temp" "$was_locked" "$dispatch" "$rows") || return 1
	summary=${result%%"$newline"*}
	content="v1|$locked|$total"
	if [ "$result" != "$summary" ]; then
		content="$content$newline${result#*"$newline"}"
	fi
	if [ -f "$file" ]; then
		stored=$(cat "$file") || return 1
		if [ "$stored" = "$content" ]; then
			printf '%s\n' "$summary"
			return 0
		fi
	elif [ "$total" = 0 ]; then
		printf '%s\n' "$summary"
		return 0
	fi
	umask 077
	tmp=$(mktemp "${file}.XXXXXX") || return 1
	trap 'rm -f -- "$tmp"' EXIT
	trap 'exit 1' HUP INT TERM
	printf '%s\n' "$content" >"$tmp" && mv -f -- "$tmp" "$file" || return 1
	printf '%s\n' "$summary"
)

# Shared history keeps one compact snapshot per sample. The controller is the
# only writer. Readers ignore an incomplete final line during an append.
temperature_history_record() (
	file=$1 stamp=$2 sensors=$3
	in_range "$stamp" 1 9999999999 || return 1
	printf '%s\n' "$sensors" | awk -F ';' -v stamp="$stamp" '
		{
			for (i = 1; i <= NF; i++) {
				split($i, fields, "|")
				label = tolower(fields[2]); value = fields[3]
				if (fields[4] !~ /^(ok|unselected)$/ || value !~ /^-?[0-9]+$/ || value + 0 < -40000 || value + 0 > 150000) continue
				if (label ~ /^(cpu-thermal|cpu_thermal(_temp1)?|cpu)$/ && cpu == "") cpu = value
				else if (label ~ /^mt7996[-_]phy0[._]0(_temp1)?$/ && radio == "") radio = value
				else if (label ~ /^(modem|mt5700m)$/ && modem == "") modem = value
				else if (label ~ /^(mdio_bus|phy)/ && phy == "") phy = value
			}
		}
		END { printf "%s|%s|%s|%s|%s\n", stamp, cpu, radio, modem, phy }
	' >>"$file"
)

# The file keeps twice the window the dashboard draws. A longer tail is never
# read, and every extra line is paid for twice: once when the controller prunes
# the file, and once more on every page load that parses it.
temperature_history_keep() {
	keep_range=${1:-5}
	is_uint "$keep_range" || keep_range=5
	[ "$keep_range" -ge 5 ] || keep_range=5
	[ "$keep_range" -le 360 ] || keep_range=360
	printf '%s\n' "$((keep_range * 120))"
}

temperature_history_read() {
	[ ! -L "$1" ] && [ -f "$1" ] || return 1
	awk -F '|' -v now="$2" -v keep="${3:-21600}" '
		NF == 5 && $1 ~ /^[0-9]+$/ && $1 + 0 > now - keep && $1 + 0 <= now && $1 + 0 > last {
			print
			last = $1 + 0
		}' "$1"
}
