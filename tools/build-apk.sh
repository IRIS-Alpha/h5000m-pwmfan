#!/bin/sh
# Build both packages from the working tree with apk's own packer.
#
# They are plain file trees: shell scripts under root/, view assets under
# htdocs/, translations under po/. Nothing is compiled, so the binary SDK is not
# needed -- and it is no longer usable for this either, because its ucode staging
# cannot be rebuilt (the binary SDK ships no package sources). `apk mkpkg`
# produces the same v3 package from any host that has apk-tools 3.
#
#   sh tools/build-apk.sh                       # unsigned
#   APK_SIGN_KEY=key.pem sh tools/build-apk.sh  # signed, ready for a repository
#   PO2LMO=/path/to/po2lmo sh tools/build-apk.sh
#
# Output lands in build/ (ignored by git).
set -eu

# The package records the owner of every file, and the device expects root. A
# rootless user namespace is enough: inside it the build runs as uid 0, so the
# stage can be chowned and mkpkg stores 0 rather than the build account.
if [ -z "${APK_BUILD_SANDBOX:-}" ]; then
	if unshare -r -- true >/dev/null 2>&1; then
		APK_BUILD_SANDBOX=unshare exec unshare -r -- "$0" "$@"
	elif command -v fakeroot >/dev/null 2>&1; then
		APK_BUILD_SANDBOX=fakeroot exec fakeroot -- "$0" "$@"
	fi
fi

REPO=$(CDPATH="" cd -- "$(dirname -- "$0")/.." && pwd)
APK_BIN=${APK:-apk}
NAME=luci-app-h5000m-pwmfan
PKG_URL=${PKG_URL:-https://github.com/IRIS-Alpha/h5000m-pwmfan}
VERSION=5.0.0
RELEASE=1
OUT=${OUT:-$REPO/build}
SIGN_KEY=${APK_SIGN_KEY:-}
I18N_NAME=luci-i18n-${NAME#luci-app-}-zh-cn
PO2LMO=${PO2LMO:-$HOME/Projects/.h5000m-work/immortalwrt-sdk/staging_dir/hostpkg/bin/po2lmo}

command -v "$APK_BIN" >/dev/null 2>&1 || {
	echo "build-apk: $APK_BIN not found; set APK=/path/to/apk-tools-3" >&2
	exit 1
}

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT INT TERM

# apk v3 keeps three metadata files in the payload: the file list, the config
# files, and the checksums they shipped with. buildroot writes the same ones, and
# apk uses them to decide what may be replaced on upgrade.
write_metadata() {
	stage=$1
	pkg=$2
	shift 2
	metadir=$stage/lib/apk/packages
	mkdir -p "$metadir"
	(cd "$stage" && find . -type f ! -path './lib/apk/packages/*' | sed 's|^\./|/|' | sort) \
		>"$metadir/$pkg.list"
	: >"$metadir/$pkg.conffiles"
	: >"$metadir/$pkg.conffiles_static"
	for conf in "$@"; do
		printf '%s\n' "$conf" >>"$metadir/$pkg.conffiles"
		sum=$(sha256sum "$stage$conf" | cut -d' ' -f1)
		printf '%s %s\n' "$conf" "$sum" >>"$metadir/$pkg.conffiles_static"
	done
}

sign() {
	[ -n "$SIGN_KEY" ] || return 0
	"$APK_BIN" --allow-untrusted adbsign --sign-key "$SIGN_KEY" --reset-signatures "$1"
}

# ---------------------------------------------------------------- ucode app --
stage=$work/stage
mkdir -p "$stage"
cp -a "$REPO/luci-app-h5000m-pwmfan/root/." "$stage/"
mkdir -p "$stage/www"
cp -a "$REPO/luci-app-h5000m-pwmfan/htdocs/." "$stage/www/"
# Everything a shell, procd or rpcd executes must stay executable; the tree mode
# is the only thing mkpkg can record.
chmod 0755 "$stage/usr/sbin/"* "$stage/etc/init.d/"*
write_metadata "$stage" "$NAME" /etc/config/h5000m_pwmfan
chown -R 0:0 "$stage"

# The install scripts are the ones luci.mk would generate for a LuCI package:
# enable and start the service on install, and let the OpenWrt helpers run.
cat >"$work/post-install" <<'EOF'
#!/bin/sh
[ "${IPKG_NO_SCRIPT}" = "1" ] && exit 0
[ -s ${IPKG_INSTROOT}/lib/functions.sh ] || exit 0
. ${IPKG_INSTROOT}/lib/functions.sh
export root="${IPKG_INSTROOT}"
export pkgname="luci-app-h5000m-pwmfan"
add_group_and_user
default_postinst
[ -n "${IPKG_INSTROOT}" ] || { /etc/init.d/h5000m-pwmfan enable; /etc/init.d/h5000m-pwmfan start; }
exit 0
EOF
cat >"$work/pre-deinstall" <<'EOF'
#!/bin/sh
[ -s ${IPKG_INSTROOT}/lib/functions.sh ] || exit 0
. ${IPKG_INSTROOT}/lib/functions.sh
export root="${IPKG_INSTROOT}"
export pkgname="luci-app-h5000m-pwmfan"
default_prerm
EOF
sed -e 's/^add_group_and_user$/export PKG_UPGRADE=1\nadd_group_and_user/' \
	"$work/post-install" >"$work/post-upgrade"
chmod 0755 "$work/post-install" "$work/pre-deinstall" "$work/post-upgrade"

mkdir -p "$OUT"
apk_file=$OUT/$NAME-$VERSION-r$RELEASE.apk
"$APK_BIN" mkpkg \
	--info "name:$NAME" \
	--info "version:$VERSION-r$RELEASE" \
	--info "description:H5000M PWM fan control" \
	--info "arch:noarch" \
	--info "license:Apache-2.0" \
	--info "origin:$PKG_URL" \
	--info "maintainer:H5000M PWM Fan contributors" \
	--info "url:$PKG_URL" \
	--info "depends:libc kmod-hwmon-pwmfan" \
	--files "$stage" \
	--script "post-install:$work/post-install" \
	--script "pre-deinstall:$work/pre-deinstall" \
	--script "post-upgrade:$work/post-upgrade" \
	-o "$apk_file"
sign "$apk_file"
echo "built $apk_file ($(wc -c <"$apk_file") bytes)"

# ------------------------------------------------------------ translation --
if [ ! -x "$PO2LMO" ]; then
	echo "build-apk: no po2lmo at $PO2LMO, skipped the translation package" >&2
	exit 0
fi

stage=$work/stage-i18n
mkdir -p "$stage/usr/lib/lua/luci/i18n" "$stage/etc/uci-defaults"
"$PO2LMO" "$REPO/luci-app-h5000m-pwmfan/po/zh_Hans/h5000m-pwmfan.po" "$stage/usr/lib/lua/luci/i18n/h5000m-pwmfan.zh-cn.lmo"
# luci.mk registers the language the same way: one uci-defaults line.
printf "%s\n" "uci set luci.languages.zh_cn='简体中文 (Simplified Chinese)'; uci commit luci" \
	>"$stage/etc/uci-defaults/$I18N_NAME"
chmod 0644 "$stage/etc/uci-defaults/$I18N_NAME"
write_metadata "$stage" "$I18N_NAME"
chown -R 0:0 "$stage"

# A translation package needs a version that moves forward so upgrades arrive.
i18n_version=0.$(date -u +%y%m%d).$(date -u +%H%M%S)
apk_file=$OUT/$I18N_NAME-$i18n_version.apk
"$APK_BIN" mkpkg \
	--info "name:$I18N_NAME" \
	--info "version:$i18n_version" \
	--info "description:Translation for $NAME - 简体中文 (Simplified Chinese)" \
	--info "arch:noarch" \
	--info "license:Apache-2.0" \
	--info "origin:$PKG_URL" \
	--info "maintainer:H5000M PWM Fan contributors" \
	--info "depends:libc $NAME" \
	--info "provides:$I18N_NAME-any" \
	--info "tags:openwrt:section=luci" \
	--files "$stage" \
	-o "$apk_file"
sign "$apk_file"
echo "built $apk_file ($(wc -c <"$apk_file") bytes)"
