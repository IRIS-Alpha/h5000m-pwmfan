#!/bin/sh
set -eu

# The package is laid out as a feed (feed/<pkg>/Makefile) so the firmware can
# consume it with a single src-git line.
PKG=luci-app-h5000m-pwmfan

# Run with STRICT=1 in CI to turn missing developer tools into failures.
strict=${STRICT:-0}
missing=0

require_tool() {
	name=$1
	if command -v "$name" >/dev/null 2>&1; then
		return 0
	fi
	printf 'missing tool: %s\n' "$name" >&2
	missing=$((missing + 1))
}

run_shellcheck() {
	shellcheck \
		"$PKG"/root/usr/sbin/h5000m-pwmfan \
		"$PKG"/root/etc/init.d/h5000m-pwmfan \
		"$PKG"/root/usr/lib/h5000m-pwmfan/controller-lib.sh \
		"$PKG"/root/usr/sbin/h5000m-pwmfan-status \
		"$PKG"/root/usr/sbin/h5000m-pwmfan-language \
		"$PKG"/root/usr/sbin/h5000m-pwmfan-history \
		"$PKG"/root/usr/sbin/h5000m-pwmfan-takeover-check \
		"$PKG"/root/usr/sbin/h5000m-pwmfan-watchdog \
		tests/controller-lib.bats \
		tests/watchdog.bats \
		tools/check.sh \
		tools/device-snapshot.sh \
		tools/l1-release.sh \
		tools/l1-poke.sh \
		tools/build-apk.sh \
		tools/publish-apk-repo.sh \
		tools/version.sh
}

run_shfmt() {
	shfmt -d \
		"$PKG"/root/usr/sbin/h5000m-pwmfan \
		"$PKG"/root/etc/init.d/h5000m-pwmfan \
		"$PKG"/root/usr/lib/h5000m-pwmfan/controller-lib.sh \
		"$PKG"/root/usr/sbin/h5000m-pwmfan-status \
		"$PKG"/root/usr/sbin/h5000m-pwmfan-language \
		"$PKG"/root/usr/sbin/h5000m-pwmfan-history \
		"$PKG"/root/usr/sbin/h5000m-pwmfan-takeover-check \
		"$PKG"/root/usr/sbin/h5000m-pwmfan-watchdog \
		tests/controller-lib.bats \
		tests/watchdog.bats \
		tools/check.sh \
		tools/device-snapshot.sh \
		tools/l1-release.sh \
		tools/l1-poke.sh \
		tools/build-apk.sh \
		tools/publish-apk-repo.sh \
		tools/version.sh
}

require_tool shellcheck
require_tool shfmt
require_tool bats
require_tool node
require_tool msgfmt

# rpcd runs these helpers on the page's behalf and the payload keeps the source
# mode, so a 0644 script is a page button that silently fails.
check_modes() {
	for script in "$PKG"/root/usr/sbin/* "$PKG"/root/etc/init.d/*; do
		if [ ! -x "$script" ]; then
			printf 'not executable: %s\n' "$script" >&2
			return 1
		fi
	done
}

sh tools/version.sh check
check_modes
if command -v shellcheck >/dev/null 2>&1; then run_shellcheck; fi
if command -v shfmt >/dev/null 2>&1; then run_shfmt; fi
if command -v bats >/dev/null 2>&1 && [ -d tests ]; then bats tests; fi
if command -v msgfmt >/dev/null 2>&1; then msgfmt --check --check-format -o /dev/null "$PKG"/po/zh_Hans/h5000m-pwmfan.po; fi
if command -v node >/dev/null 2>&1; then
	node --check "$PKG"/htdocs/luci-static/resources/view/h5000m-pwmfan.js
	node --check "$PKG"/htdocs/luci-static/resources/view/h5000m-pwmfan-advanced.js
	node --check "$PKG"/htdocs/luci-static/resources/view/h5000m-pwmfan-shared.js
	node --check tests/preview.mjs
	node tools/check-i18n.mjs
	# The browser pass needs a running preview and Playwright; opt in with the URL.
	if [ -n "${PWMFAN_PREVIEW_URL:-}" ] && [ -f tests/preview.mjs ]; then
		node tests/preview.mjs
	fi
fi

if [ "$strict" = 1 ] && [ "$missing" -ne 0 ]; then
	printf '%s\n' 'required development tools are missing' >&2
	exit 1
fi
