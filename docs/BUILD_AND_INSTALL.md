# Building and installing the plugin package

Rewritten 2026-11-24: the package is now assembled with `apk mkpkg` from the working tree and no SDK is involved.

## Why there is no SDK build any more

The October SDK (`/home/devcc/Projects/.h5000m-work/immortalwrt-sdk`) is a **binary** SDK: it ships prebuilt staging but
no package sources. Its ucode/json-c staging was lost while pinning LuCI, and rebuilding it is impossible
(`No rule to make target 'package/libs/json-c/compile'`). The same archives it ships contain no ucode target staging,
so the SDK cannot be repaired from the tarball either.

Nothing of value was lost. The package is a plain file tree — `luci-app-h5000m-pwmfan/root/` and
`luci-app-h5000m-pwmfan/htdocs/` are copied into the payload and nothing is compiled — and `git -C $S/feeds/luci diff --stat ebc4118b71 ad75cde -- luci.mk` is **empty**, so pinning the
LuCI revision for the device (`ad75cde`) would not have changed a single byte of the package anyway.

## Layout

The repository root is a feed, so the package lives in its own directory:

```
luci-app-h5000m-pwmfan/   Makefile, root/, htdocs/, po/   <- what the firmware builds
docs/ tools/ tests/ packaging/ .github/                  <- development only, no Makefile
```

`scripts/feeds` scans a feed for `<dir>/Makefile`, so the firmware consumes this repository with a single
`src-git` line; see `docs/DISTRIBUTION.md`. `tools/build-apk.sh` reads the same directory, so a local package and a
firmware-built package come from identical sources.

## Build

```sh
cd /home/devcc/Projects/h5000m-pwmfan
APK=/path/to/apk-tools-3 sh tools/build-apk.sh                    # unsigned
APK_SIGN_KEY=~/Projects/.h5000m-work/apk-keys/h5000m-private.pem \
  APK=/path/to/apk-tools-3 sh tools/build-apk.sh                  # signed
```

The apk-tools 3 binary is the one the SDK already provides:
`$S/staging_dir/host/bin/apk` (3.0.5).

The script produces two packages in `build/`:

- `luci-app-h5000m-pwmfan-5.0.0-r1.apk` — about 52 KB. The SDK build was 45.8 KB because `luci.mk` minified the view
  scripts with jsmin; the mkpkg build ships the readable sources. The file set is identical (17 files, verified by
  extracting both and diffing).
- `luci-i18n-h5000m-pwmfan-zh-cn-<date>.<time>.apk` — about 4.3 KB, compiled from `luci-app-h5000m-pwmfan/po/zh_Hans/h5000m-pwmfan.po` with
  `po2lmo`. The version is derived from the build clock so upgrades move forward.

Things the script does that are easy to miss when packing by hand:

- It re-executes itself inside `unshare -r` (falling back to `fakeroot`), then `chown -R 0:0` the stage. Without that
  the payload records the build account and the device installs everything as `nobody:nogroup`.
- It chmods `usr/sbin/*` and `etc/init.d/*` to 0755 — the tree mode is the only thing `mkpkg` can record.
- It writes the three apk v3 metadata files buildroot would write: `lib/apk/packages/<name>.list`,
  `<name>.conffiles` and `<name>.conffiles_static`. `conffiles` is **not** a valid `--info` field (`invalid info
  field: conffiles`); the payload file is what makes `/etc/config/h5000m_pwmfan` survive an upgrade.
- It reproduces the `post-install`/`pre-deinstall`/`post-upgrade` scripts `luci.mk` generates: enable and start the
  service, run `default_postinst`, and set `PKG_UPGRADE=1` on upgrade.

## Versioning

`luci-app-h5000m-pwmfan/Makefile` holds the only copy of the number
(`PKG_VERSION`, `PKG_RELEASE`). `tools/build-apk.sh` reads it from there, so the
source tree, the package and the published feed cannot drift apart, and
`tools/check.sh` fails if the build script ever hard-codes a version again.

The number means the same thing it means for any package:

| Field | Bump it when | Example |
| --- | --- | --- |
| `MAJOR` | the requirement baseline changes | V6 adopted → `6.0.0` |
| `MINOR` | a user-visible behaviour change or a new setting | new guard option → `5.1.0` |
| `PATCH` | a fix that adds no setting | chart stops drawing → `5.0.1` |
| `RELEASE` | the same code is packaged again: dependency, translation, docs inside the package | `5.0.0-r2` |

Bumping major, minor or patch resets `RELEASE` to 0. A translation or packaging
change alone takes a `RELEASE` bump — it never carries a behaviour change with it.

```sh
sh tools/version.sh              # 5.0.0-r2
sh tools/version.sh bump patch   # 5.0.1-r0
sh tools/version.sh bump release # 5.0.1-r1, packaging only
sh tools/version.sh check        # what tools/check.sh runs
```

Two rules follow from how `apk` compares versions:

- A device only installs a **strictly higher** version, so every published build
  gets a new number. Publishing the same version with different files is not an
  update, it is a silent no-op.
- The `luci-i18n-h5000m-pwmfan-zh-cn` package keeps its date version
  (`0.<UTC date>.<UTC time>`), which rises on every build by construction.

Publishing is from a tagged commit of a clean tree (`tools/publish-apk-repo.sh`
refuses a dirty one):

```sh
git tag -a v5.0.0-r2 -m "5.0.0-r2"
sh tools/publish-apk-repo.sh --push
```

## Reinstalling the same version

`apk` treats an equal version as already installed, so editing a file and
reinstalling `5.0.0-r1` over `5.0.0-r1` is a no-op — the router keeps the old
file. Remove both packages first, then install them again:

```sh
apk del luci-i18n-h5000m-pwmfan-zh-cn luci-app-h5000m-pwmfan
apk add luci-app-h5000m-pwmfan luci-i18n-h5000m-pwmfan-zh-cn
```

Both have to go in one transaction: the i18n package depends on the app, so
`apk del luci-app-h5000m-pwmfan` on its own refuses with
`luci-app-h5000m-pwmfan: luci-i18n-h5000m-pwmfan-zh-cn`. `/etc/config/h5000m_pwmfan`
is a conffile, so the removal keeps it and the install drops the new defaults in
`/etc/config/h5000m_pwmfan.apk-new` beside it.

Bump `PKG_RELEASE` for a release instead of relying on this: the trap only
exists because local builds reuse the version number.

## Install

```sh
scp build/*.apk root@192.168.10.1:/tmp/
ssh root@192.168.10.1 'apk add --allow-untrusted --force-overwrite /tmp/*.apk'
ssh root@192.168.10.1 'rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache'
```

An upgrade prints `Installing file to etc/config/h5000m_pwmfan.apk-new` (the shipped default beside the kept config) and
keeps `/etc/config/h5000m_pwmfan` byte for byte, so the user's settings survive. Verify with `ls -l` that the installed
scripts are `root root` and 0755, and that `cat /var/run/h5000m-pwmfan/status` still reports `state=running`.

Signed packages need no `--allow-untrusted` once the matching public key is in `/etc/apk/keys/`; see
`docs/DISTRIBUTION.md`.

## Private key

The signing key lives **outside** the repository at `~/Projects/.h5000m-work/apk-keys/h5000m-private.pem` (mode 0600).
Only the public half, `packaging/h5000m-apk.pem`, is tracked. `.gitignore` excludes `packaging/*private*.pem`,
`packaging/*.key`, `keys/` and `build/`. Never commit the private key: it is the only thing that makes a package look
like it came from us.

## Translations

`luci-app-h5000m-pwmfan/po/zh_Hans/h5000m-pwmfan.po` is compiled by `tools/build-apk.sh` into the `luci-i18n-h5000m-pwmfan-zh-cn` package,
and `tools/preview.py` compiles it at startup — restart the preview after editing the po, otherwise the preview keeps
serving the old catalogue. Installing only the app package leaves the device on whatever catalogue was installed last:
the device reads `/usr/lib/lua/luci/i18n/h5000m-pwmfan.zh-cn.lmo`, and new msgids stay in English until the i18n
package is installed too.

LuCI merges **every installed catalogue into one dictionary**, so a msgid that another package also uses is resolved by
load order, not by package. `Quiet`/`Balanced` were shadowed by `base.zh-cn` and the legacy `h5000m-fancontrol`
catalogue; the presets now use `Quiet mode`/`Balanced mode`/`Performance mode`. When adding strings, prefer msgids that
are unlikely to exist elsewhere.

## Takeover gate after installing

`apply_cycle` takes the fan only when all of these hold, checked by
`kernel_takeover_ready()` → `kernel_takeover_ready_dir()` (`luci-app-h5000m-pwmfan/root/usr/sbin/h5000m-pwmfan:487`):

- `h5000m_pwmfan.main.enabled=1`;
- `h5000m_pwmfan.main.kernel_takeover=1` **and** `takeover_verified=1` (a value this repository never writes itself);
- a writable fan `pwm1` and a cooling device of type `pwm-fan` bound to a thermal zone.

Otherwise the daemon releases the fan and reports `state=disabled` with `reason=takeover_pending` (enabled but not
verified), `reason=not_enabled` (fresh install), or `reason=released` right after releasing a fan it used to own. Check
the live answer with `cat /var/run/h5000m-pwmfan/status`; `takeover_verified` is set by the person who verified the
handover, not by the package.

## Legacy fan controller

The stock `luci-app-h5000m-fancontrol` (2.1.3-r1) was removed on 2026-11-23 to end the duplicate menu entry and its
msgid shadowing. Its service had already been stopped and disabled. The snapshot feed is unreachable, so the removal
could not be undone with `apk add`, and the files were archived first:

- router: `/root/h5000m-backup/legacy-fancontrol-20261123.tgz`
- workstation: `C:\Users\31190\ego-h5000m\device-backup\legacy-fancontrol-20261123.tgz`
  (md5 `09ba65f4c580663e0585250a7dd5d087`)

A manual restore means extracting that tarball over `/` and clearing `/tmp/luci-indexcache*`. `/etc/config/h5000m_fancontrol`
survives the purge because apk keeps modified conffiles, so the old curves are still on the device if the package ever
comes back.
