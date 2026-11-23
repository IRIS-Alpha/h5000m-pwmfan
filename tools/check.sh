#!/bin/sh
set -eu

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
		root/usr/sbin/h5000m-pwmfan \
		root/etc/init.d/h5000m-pwmfan \
		root/usr/lib/h5000m-pwmfan/controller-lib.sh \
		root/usr/sbin/h5000m-pwmfan-status \
		root/usr/sbin/h5000m-pwmfan-language \
		tests/controller-lib.bats \
		tools/check.sh \
		tools/device-snapshot.sh \
		tools/l1-release.sh \
		tools/l1-poke.sh
}

run_shfmt() {
	shfmt -d \
		root/usr/sbin/h5000m-pwmfan \
		root/etc/init.d/h5000m-pwmfan \
		root/usr/lib/h5000m-pwmfan/controller-lib.sh \
		root/usr/sbin/h5000m-pwmfan-status \
		root/usr/sbin/h5000m-pwmfan-language \
		tests/controller-lib.bats \
		tools/check.sh \
		tools/device-snapshot.sh \
		tools/l1-release.sh \
		tools/l1-poke.sh
}

require_tool shellcheck
require_tool shfmt
require_tool bats
require_tool node
require_tool msgfmt

if command -v shellcheck >/dev/null 2>&1; then run_shellcheck; fi
if command -v shfmt >/dev/null 2>&1; then run_shfmt; fi
if command -v bats >/dev/null 2>&1 && [ -d tests ]; then bats tests; fi
if command -v msgfmt >/dev/null 2>&1; then msgfmt --check --check-format -o /dev/null po/zh_Hans/h5000m-pwmfan.po; fi
if command -v node >/dev/null 2>&1; then
	node --check htdocs/luci-static/resources/view/h5000m-pwmfan.js
	node --check htdocs/luci-static/resources/view/h5000m-pwmfan-advanced.js
	node --check htdocs/luci-static/resources/view/h5000m-pwmfan-shared.js
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
