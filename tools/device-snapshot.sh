#!/bin/sh
# Read-only capture of everything the fan-control package touches.
#
# On the router:            sh tools/device-snapshot.sh > /tmp/snapshot.txt
# From a workstation:       ssh root@192.168.10.1 'sh -s' < tools/device-snapshot.sh
#
# Nothing here writes to the device: the PWM, the thermal trips and the UCI
# config are only read, so the snapshot is safe to take at any time.
set -u

section() { printf '\n== %s ==\n' "$1"; }

section system
uname -a
printf 'uptime seconds: '
cut -d' ' -f1 /proc/uptime 2>/dev/null || echo '?'
printf 'load average: '
cat /proc/loadavg 2>/dev/null || echo '?'

section packages
apk info -v 2>/dev/null | grep -i h5000m || echo '(no h5000m packages)'

section config
uci show h5000m_pwmfan 2>/dev/null || echo '(no h5000m_pwmfan config)'

section service
if /etc/init.d/h5000m-pwmfan enabled 2>/dev/null; then
	echo 'autostart: enabled'
else
	echo 'autostart: disabled'
fi
printf 'pid: '
cat /var/run/h5000m-pwmfan/pid 2>/dev/null || echo '(none)'

section status
cat /var/run/h5000m-pwmfan/status 2>/dev/null || echo '(no status file)'

section takeover
printf 'state: '
cat /var/run/h5000m-pwmfan/thermal-takeover 2>/dev/null || echo '(not pinned)'

section hwmon
for dir in /sys/class/hwmon/hwmon*; do
	[ -d "$dir" ] || continue
	printf '%s name=%s\n' "$dir" "$(cat "$dir/name" 2>/dev/null)"
	for file in temp1_input temp1_max temp1_crit pwm1 pwm1_enable; do
		[ -r "$dir/$file" ] || continue
		printf '  %s = %s\n' "$file" "$(cat "$dir/$file" 2>/dev/null)"
	done
done

section thermal
for zone in /sys/class/thermal/thermal_zone*; do
	[ -d "$zone" ] || continue
	printf '%s type=%s policy=%s\n' "$zone" \
		"$(cat "$zone/type" 2>/dev/null)" "$(cat "$zone/policy" 2>/dev/null)"
	for trip in "$zone"/trip_point_*_temp; do
		[ -e "$trip" ] || continue
		printf '  %s = %s\n' "${trip##*/}" "$(cat "$trip" 2>/dev/null)"
	done
	for bind in "$zone"/cdev*_trip_point; do
		[ -e "$bind" ] || continue
		printf '  %s = %s\n' "${bind##*/}" "$(cat "$bind" 2>/dev/null)"
	done
done
for cdev in /sys/class/thermal/cooling_device*; do
	[ -d "$cdev" ] || continue
	printf '%s type=%s cur=%s max=%s\n' "$cdev" \
		"$(cat "$cdev/type" 2>/dev/null)" \
		"$(cat "$cdev/cur_state" 2>/dev/null)" \
		"$(cat "$cdev/max_state" 2>/dev/null)"
done

section installed files
for file in /usr/sbin/h5000m-pwmfan \
	/usr/sbin/h5000m-pwmfan-status \
	/usr/sbin/h5000m-pwmfan-history \
	/usr/lib/h5000m-pwmfan/controller-lib.sh \
	/www/luci-static/resources/view/h5000m-pwmfan.js \
	/www/luci-static/resources/view/h5000m-pwmfan-advanced.js \
	/www/luci-static/resources/view/h5000m-pwmfan.css \
	/usr/lib/lua/luci/i18n/h5000m-pwmfan.zh-cn.lmo; do
	[ -e "$file" ] || continue
	printf '%s bytes md5=%s %s\n' "$(wc -c <"$file")" \
		"$(md5sum "$file" 2>/dev/null | cut -d' ' -f1)" "$file"
done

section log
logread 2>/dev/null | grep 'h5000m-pwmfan' | tail -n 20 || echo '(no log lines)'
