# Building and installing the plugin package

Recorded 2026-11-22 from the first successful on-device deployment of the current UI.

## Environment

- Local SDK: `/home/devcc/Projects/.h5000m-work/immortalwrt-sdk` (October snapshot, `mediatek/filogic`,
  `aarch64_cortex-a53`).
- Package source lives in this repository (`htdocs/`, `po/`, `root/`, `Makefile`); the SDK holds a copy at
  `package/luci-app-h5000m-pwmfan`.
- The device runs a **later** source tree than the SDK (see `docs/FIRMWARE_PROVENANCE.md`), so packages install with
  `--allow-untrusted` and are not signed with the device trust key.

## The SDK cannot build the feed dependencies

`feeds/base` in this SDK is a symlink to `../package`, i.e. the base feed is absent. Building the plugin therefore
fails while compiling `lucihttp` (`lua.h`, then `ucode/module.h`) and `ucode` (needs `json-c`). Fetching the missing
packages from the pinned upstream commit
`e695009c15c623f4f6a83376b505faaf7a4ae5b5` gets `lua` built, but the chain keeps growing.

The workaround that works — **in the SDK copy only**, never in this repository:

```make
# package/luci-app-h5000m-pwmfan/Makefile, SDK copy
LUCI_DEPENDS:=
```

With no LuCI dependencies the package compiles alone; the device already has `luci-base`, `liblucihttp` and `ucode`.

## Build

```sh
cd /home/devcc/Projects/h5000m-pwmfan
S=/home/devcc/Projects/.h5000m-work/immortalwrt-sdk
rsync -a --delete htdocs/ $S/package/luci-app-h5000m-pwmfan/htdocs/
rsync -a --delete po/     $S/package/luci-app-h5000m-pwmfan/po/
rm -rf $S/build_dir/target-*/luci-app-h5000m-pwmfan        $S/staging_dir/target-*/stamp/.luci-app-h5000m-pwmfan*
cd $S && make package/luci-app-h5000m-pwmfan/compile
```

Artifacts land in `$S/bin/packages/aarch64_cortex-a53/base/`:

- `luci-app-h5000m-pwmfan-<version>-r<n>.apk`
- `luci-i18n-h5000m-pwmfan-zh-cn-<date>.apk` — its version is derived from the build date, so it changes on every
  rebuild even when nothing translated.

`PKG_RELEASE` in this repository's `Makefile` must be bumped for a real release; the SDK copy is overwritten from the
repository each time.

## Stale build products

`luci.mk` populates `build_dir/.../.pkgdir` and the staging stamps. If the JavaScript changes and the stamp survives,
the previous file is silently packaged. Always delete the build directory and the staging stamp before rebuilding, then
check the packaged payload:

```sh
grep -c pf-points-head $S/build_dir/target-*/luci-app-h5000m-pwmfan/.pkgdir/luci-app-h5000m-pwmfan/www/luci-static/resources/view/h5000m-pwmfan.js
```

The packaged view is **minified** (about 46 lines / 39 KB versus 46 KB of source), so comparing hashes with the source
is meaningless — compare file size and a marker string instead.

## Install

```sh
scp .../luci-app-h5000m-pwmfan-*.apk .../luci-i18n-h5000m-pwmfan-zh-cn-*.apk root@192.168.10.1:/tmp/
ssh root@192.168.10.1 'cd /tmp && apk add --allow-untrusted --force-overwrite ./*.apk'
ssh root@192.168.10.1 'rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache'
```

Keep the previous APKs in `/tmp` for rollback, then hard-reload the browser with cache disabled before judging the
result.

## Translations

`po/zh_Hans/h5000m-pwmfan.po` is compiled at build time, and `tools/preview.py` compiles it at startup — restart the
preview after editing the po, otherwise the preview keeps serving the old catalogue.

LuCI merges **every installed catalogue into one dictionary**, so a msgid that another package also uses is resolved by
load order, not by package. `Quiet`/`Balanced` were shadowed by `base.zh-cn` and the legacy `h5000m-fancontrol`
catalogue; the presets now use `Quiet mode`/`Balanced mode`/`Performance mode`. When adding strings, prefer msgids that
are unlikely to exist elsewhere.

## Takeover gate after installing

`apply_cycle` takes the fan only when all of these hold, checked by
`kernel_takeover_ready()` → `kernel_takeover_ready_dir()` (`root/usr/sbin/h5000m-pwmfan:487`):

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
