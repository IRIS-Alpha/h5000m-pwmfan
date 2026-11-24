#!/bin/sh
# Read or bump the package version.
#
#   sh tools/version.sh                 # print the current version
#   sh tools/version.sh bump patch      # 5.0.1-r0
#   sh tools/version.sh bump minor      # 5.1.0-r0
#   sh tools/version.sh bump major      # 6.0.0-r0
#   sh tools/version.sh bump release    # 5.0.1-r1 (packaging-only rebuild)
#   sh tools/version.sh check           # fail when the two files disagree
#
# `luci-app-h5000m-pwmfan/Makefile` is the single source of truth;
# `tools/build-apk.sh` reads it, so the only file this script edits is that one.
#
# Bumping the version is what a release means here. A device only installs a
# package whose version is higher than the one it has, so shipping changed files
# under an unchanged version is a silent no-op.
set -eu

REPO=$(CDPATH="" cd -- "$(dirname -- "$0")/.." && pwd)
MAKEFILE=$REPO/luci-app-h5000m-pwmfan/Makefile
BUILD=$REPO/tools/build-apk.sh

version=$(sed -n 's/^PKG_VERSION:=//p' "$MAKEFILE")
release=$(sed -n 's/^PKG_RELEASE:=//p' "$MAKEFILE")

[ -n "$version" ] && [ -n "$release" ] || {
	echo "version: cannot read PKG_VERSION/PKG_RELEASE from $MAKEFILE" >&2
	exit 1
}

valid() {
	case "$1" in
	'' | *[!0-9]*) return 1 ;;
	*) return 0 ;;
	esac
}

major=${version%%.*}
rest=${version#*.}
minor=${rest%%.*}
patch=${rest#*.}
for part in "$major" "$minor" "$patch"; do
	valid "$part" || {
		echo "version: $version is not MAJOR.MINOR.PATCH" >&2
		exit 1
	}
done

write() {
	tmp=$MAKEFILE.new
	sed -e "s/^PKG_VERSION:=.*/PKG_VERSION:=$1/" -e "s/^PKG_RELEASE:=.*/PKG_RELEASE:=$2/" \
		"$MAKEFILE" >"$tmp"
	mv "$tmp" "$MAKEFILE"
	printf '%s-r%s\n' "$1" "$2"
}

case "${1:-show}" in
show)
	printf '%s-r%s\n' "$version" "$release"
	;;
bump)
	case "${2:-}" in
	patch) write "$major.$minor.$((patch + 1))" 0 ;;
	minor) write "$major.$((minor + 1)).0" 0 ;;
	major) write "$((major + 1)).0.0" 0 ;;
	release) write "$version" "$((release + 1))" ;;
	*)
		echo "version: bump needs patch, minor, major or release" >&2
		exit 1
		;;
	esac
	;;
check)
	# The build script must not carry its own copy of the number: that is how a
	# release ends up with two versions depending on which path built it.
	if grep -Eq '^VERSION=[0-9]|^RELEASE=[0-9]' "$BUILD"; then
		echo "version: tools/build-apk.sh still hard-codes VERSION/RELEASE" >&2
		exit 1
	fi
	printf 'version %s-r%s, single source of truth\n' "$version" "$release"
	;;
*)
	echo "usage: sh tools/version.sh [show|bump patch|minor|major|release|check]" >&2
	exit 1
	;;
esac
