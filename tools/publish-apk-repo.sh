#!/bin/sh
# Assemble a signed apk repository from the working tree.
#
#   sh tools/publish-apk-repo.sh                 # build repo/ locally
#   sh tools/publish-apk-repo.sh --push          # also update the gh-pages branch
#
# Output layout (this is what GitHub Pages serves):
#
#   repo/aarch64_cortex-a53/packages.adb
#   repo/aarch64_cortex-a53/luci-app-h5000m-pwmfan-*.apk
#   repo/aarch64_cortex-a53/luci-i18n-h5000m-pwmfan-zh-cn-*.apk
#   repo/h5000m-apk.pem
#
# The feed line a device needs is
#   https://<owner>.github.io/<repo>/aarch64_cortex-a53/packages.adb
# and the key goes to /etc/apk/keys/h5000m-apk.pem.
set -eu

REPO=$(CDPATH="" cd -- "$(dirname -- "$0")/.." && pwd)
ARCH=aarch64_cortex-a53
APK_BIN=${APK:-apk}
KEY_DIR=${KEY_DIR:-$HOME/Projects/.h5000m-work/apk-keys}
SIGN_KEY=${APK_SIGN_KEY:-$KEY_DIR/h5000m-private.pem}
PUBLIC_KEY=$REPO/packaging/h5000m-apk.pem
OUT=${OUT:-$REPO/repo}
PUSH=${1:-}

[ -f "$SIGN_KEY" ] || {
	echo "publish-apk-repo: signing key missing at $SIGN_KEY" >&2
	exit 1
}

command -v "$APK_BIN" >/dev/null 2>&1 || {
	echo "publish-apk-repo: $APK_BIN not found; set APK=/path/to/apk-tools-3" >&2
	exit 1
}

# Build both packages with the repository key, then index them. Clear earlier
# artefacts first: a stale i18n package from an older timestamp would otherwise
# be indexed alongside the fresh one and the device could pick either.
rm -f "$REPO"/build/*.apk
APK="$APK_BIN" APK_SIGN_KEY="$SIGN_KEY" sh "$REPO/tools/build-apk.sh"

rm -rf "$OUT"
mkdir -p "$OUT/$ARCH"
cp "$REPO"/build/luci-app-h5000m-pwmfan-*.apk "$REPO"/build/luci-i18n-h5000m-pwmfan-zh-cn-*.apk "$OUT/$ARCH/"
cp "$PUBLIC_KEY" "$OUT/h5000m-apk.pem"

# mkndx must be told not to trust the outer signature it cannot check; without
# --allow-untrusted it prints UNTRUSTED and writes nothing.
(
	cd "$OUT/$ARCH"
	"$APK_BIN" mkndx --allow-untrusted --sign-key "$SIGN_KEY" -o packages.adb ./*.apk
)

# Feed line the page advertises. Derived from the origin remote unless the
# caller overrides it, so the page never ships a placeholder address.
FEED_URL=${FEED_URL:-}
if [ -z "$FEED_URL" ]; then
	remote=$(git -C "$REPO" remote get-url origin 2>/dev/null || true)
	remote=${remote%.git}
	remote=${remote%/}
	case $remote in
	git@github.com:*) slug=${remote#git@github.com:} ;;
	https://github.com/*) slug=${remote#https://github.com/} ;;
	*) slug= ;;
	esac
	if [ -n "$slug" ]; then
		owner=$(printf '%s' "${slug%%/*}" | tr '[:upper:]' '[:lower:]')
		FEED_URL="https://$owner.github.io/${slug#*/}/$ARCH/packages.adb"
	fi
fi
[ -n "$FEED_URL" ] || FEED_URL="https://OWNER.github.io/REPO/$ARCH/packages.adb"

# A short readme so the Pages site explains itself and does not look like a stray
# directory listing.
cat >"$OUT/index.html" <<EOF
<!doctype html>
<meta charset="utf-8">
<title>H5000M PWM fan plugin packages</title>
<h1>H5000M PWM fan plugin — apk repository</h1>
<p>Feed line for <code>/etc/apk/repositories.d/customfeeds.list</code>:</p>
<pre><code>$FEED_URL</code></pre>
<p>Public key: <a href="h5000m-apk.pem">h5000m-apk.pem</a></p>
EOF

echo "repository assembled in $OUT"
find "$OUT" -type f -printf '  %P  %s bytes\n' | sort

if [ "$PUSH" != "--push" ]; then
	echo "not pushed; run with --push to update the gh-pages branch" >&2
	exit 0
fi

# Publish without touching the working tree: a detached worktree of gh-pages.
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT INT TERM
# Base the new commit on what the remote already has: the local gh-pages ref is
# never updated by these pushes, so building on it would make every publish a
# non-fast-forward.
if git -C "$REPO" fetch --quiet origin gh-pages 2>/dev/null &&
	git -C "$REPO" rev-parse --verify --quiet origin/gh-pages >/dev/null; then
	git -C "$REPO" worktree add --quiet --detach "$work" origin/gh-pages
elif git -C "$REPO" rev-parse --verify --quiet gh-pages >/dev/null; then
	git -C "$REPO" worktree add --quiet --detach "$work" gh-pages
else
	git -C "$REPO" worktree add --quiet --detach "$work"
	git -C "$work" checkout --quiet --orphan gh-pages
	git -C "$work" rm -rf --quiet . >/dev/null 2>&1 || true
fi
find "$work" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -a "$OUT/." "$work/"
git -C "$work" add -A
git -C "$work" -c user.name="apk repo" -c user.email="apk-repo@localhost" \
	commit --quiet -m "apk repository $(date -u +%Y-%m-%dT%H:%M:%SZ)"
# Push the commit, not a branch name: the worktree is detached, so a plain
# "push origin gh-pages" would push the stale local branch and drop the
# commit we just made.
# gh-pages is a generated branch: force the update so a lost local ref cannot
# block a release.
git -C "$work" push --quiet --force origin HEAD:gh-pages
echo "pushed gh-pages"
