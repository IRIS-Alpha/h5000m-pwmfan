# Distribution

> 中文说明：本文描述分发方案。决策由用户在 2026-11-24 拍板（自建 APK 仓库 + 签名索引）；文中标注了哪些步骤已经在本机验证、哪些还没有。

## Decision

Maintain our own APK repository for `luci-app-h5000m-pwmfan` and its translation
package, published with a signed index. Do not submit to an official feed.

Reasons:

- The package is device-specific (a single board model, a single fan path), so a
  feed would not buy any audience.
- Feeds move on the vendor's schedule; a self-hosted repository can ship a fix the
  same day.
- The firmware already trusts only its own build keys, so any package we publish is
  installed with `--allow-untrusted` today. Owning the repository is the only way to
  replace that with a signature the device can check.

## What the device looks like

Measured 2026-11-24 on `192.168.10.1`:

| Item | Value |
|---|---|
| Distribution | ImmortalWrt SNAPSHOT, `r0-a4ba824`, `mediatek/filogic`, `aarch64_cortex-a53` |
| apk | `3.0.5` (v3 index format, `.adb`) |
| Repository configuration | `/etc/apk/repositories` is **absent**; the device uses `/etc/apk/repositories.d/` (`customfeeds.list`, `distfeeds.list`) |
| Trusted keys | `/etc/apk/keys/{immortalwrt-snapshots,openwrt-snapshots,public-key}.pem`, EC P-256, 178 B each |

Our key is the same shape (EC P-256, 178 B) and is accepted by the device's `apk verify` once installed in
`/etc/apk/keys/`. That test passed: a package signed with it verifies `OK` on the router.

The three firmware keys cannot be used — the SDK's own `public-key.pem` has md5 `33aa0401…` while the device's has
`0bc11f49…`, so even the SDK's original APK verifies as `UNTRUSTED signature` on the router. Publishing our public key
is therefore part of the install instructions, not an afterthought.

## Layout

```
repo/
  aarch64_cortex-a53/
    packages.adb                     # v3 index (this exact name; see below)
    luci-app-h5000m-pwmfan-0.1.0-r2.apk
    luci-i18n-h5000m-pwmfan-zh-cn-<version>.apk
  h5000m-apk.pem                     # our public key, installed to /etc/apk/keys/
```

Client side:

```sh
wget -O /etc/apk/keys/h5000m-apk.pem https://<host>/apk/h5000m-apk.pem
echo 'https://<host>/apk/aarch64_cortex-a53/packages.adb' >> /etc/apk/repositories.d/customfeeds.list
apk update && apk add luci-app-h5000m-pwmfan
```

The line in `customfeeds.list` must point at **the index file itself**. A bare directory is accepted by the parser,
but apk 3.0.5 then treats the feed as a v2 repository: it appends `<dir>/aarch64_cortex-a53/APKINDEX.tar.gz`, which
does not exist on a v3 feed, and the source shows up as unavailable. Renaming our index to `Packages.adb` does not
change that — only a full URL to `packages.adb` works.

`packages.adb` is also the name the upstream feeds use, at any revision: both
`downloads.immortalwrt.org/snapshots/packages/aarch64_cortex-a53/base/packages.adb` and the OpenWrt equivalent answer
`206` to a range request, while `APKINDEX.adb` and `APKINDEX.tar.gz` answer `404`. The device's own
`distfeeds.list` names `packages.adb` on all seven lines. `APKINDEX.adb` never existed: the v2 index was
`APKINDEX.tar.gz`, which the apk binary still carries as a legacy string. So the name is a property of apk v3, not of
which SDK built the package.

## Tooling, verified end to end

Everything below was executed on the router, not just on the host.

- `openssl ecparam -name prime256v1 -genkey -noout` plus `openssl ec -pubout` yields the key pair. Public key
  `packaging/h5000m-apk.pem`, sha256 `d8827e25…18aa0`; the private half is kept outside the repository.
- `apk --allow-untrusted adbsign --sign-key <private> --reset-signatures <apk>` rewrites the signature in place.
- `apk mkndx --allow-untrusted --sign-key <private> -o packages.adb *.apk` builds the signed index
  (`Index has 2 packages`).
- Served from `/www/apk/aarch64_cortex-a53/` by the device's own uhttpd, `apk update` reported
  `http://127.0.0.1/apk/aarch64_cortex-a53/packages.adb` as a source, `apk search h5000m` listed both packages, and
  `apk add luci-i18n-h5000m-pwmfan-zh-cn` installed **without** `--allow-untrusted` after the public key was placed in
  `/etc/apk/keys/`.

Traps found while testing:

1. **`adbsign` without `--allow-untrusted` truncates the package.** It stops at the signature it cannot check and
   leaves a 1,970-byte stub in place of a 45,807-byte package, prints no error and returns 0. Always pass the flag,
   then check the file size.
2. **`mkndx` needs the same flag** for the same reason: without it only `ERROR: … UNTRUSTED signature` is printed and
   no index is written.
3. **A host `apk verify` can report `UNTRUSTED` for a package the device accepts.** The SDK's host build does not
   derive the key id the same way; verify on the router (`apk verify --keys-dir /tmp/kd /tmp/pkg.apk`) before
   concluding the signature is wrong.
4. **The index is `packages.adb`, not `APKINDEX.adb`.** apk 3.0.5 looks for `packages.adb` for v3 repositories.

## Why not pin the device's LuCI revision

The device runs LuCI `26.315.10273~ad75cde` while the SDK carries `ebc4118b71`. `git diff ebc4118b71 ad75cde -- luci.mk`
is **empty**, and this package only copies files (`root/`, `htdocs/`, `po/`), so the revision makes no difference to the
package. Pinning it in the binary SDK is also impossible: checkout plus rebuild fails on `package/utils/ucode`
(missing `json-c`) because the binary SDK ships no `package/libs` sources.

## Open before publishing

1. **Hosting.** GitHub Pages, chosen 2026-11-24; the branch and the repository do not exist yet, and the user publishes
   after reviewing the contents (no private keys, no build directories).
2. **Version bumping.** `PKG_RELEASE` in `Makefile` and `RELEASE` in `tools/build-apk.sh` must move together; the
   translation package derives its version from the build clock instead.

## Ways to deliver the plugin (discussion, not yet decided)

Three different questions get mixed together; keeping them apart makes the choices obvious.

| Question | Answer |
|---|---|
| Where does the package live? | **Hosting** — a web location that stays reachable (GitHub Pages, object storage, our own server, or the router's own `/www` for a LAN-only test) |
| Is it published? | **Release** — signed index and packages uploaded, public key distributed, one feed line or one `wget` in the install instructions |
| Is it inside the firmware? | **Baking** — the package is part of the image, so a freshly flashed router already has the menu entry |

Publishing does not require baking, and baking does not require publishing. The plugin is shell and JavaScript only, so
every option below works on any firmware revision that ships LuCI.

### Runtime install (no firmware build)

1. **Manual copy** — `scp` the APK and `apk add --allow-untrusted`. What the router runs today. Zero infrastructure,
   manual steps on every device and every update.
2. **Signed APK repository** — the option verified in this document. The device keeps one feed line and updates with
   `apk upgrade`; no reflash, configuration untouched. Hosting is the only open decision.

### Baking into the firmware (needs a build of the firmware itself)

1. **Package inside a full buildroot tree** — put this repository under `package/` or point a feed at it, then build the
   whole firmware and flash it. Needs the firmware sources for this exact device.
2. **Imagebuilder image** — `immortalwrt-imagebuilder-mediatek-filogic.Linux-x86_64.tar.zst` from the snapshot server,
   add both packages to `PACKAGES`, get a sysupgrade image in roughly ten minutes. **Caveat:** the published
   imagebuilder belongs to snapshot `r42542-e695009c15`, while this router runs the custom firmware
   `H5000M-CI-Qmodem-OP` at `r0-a4ba824`. Flashing the public image replaces the whole system — kernel, QModem patches,
   every local adjustment — not just the fan plugin.
3. **Submit to the firmware feed** — a package maintained upstream. Long review cycle, and the audience is one board
   model, so the value is low.
4. **Vendor integration** — the board vendor builds it in. Requires their source tree and packaging process, which is
   exactly what we do not have.

### What this means here

- The router runs a **custom firmware built by the user's own CI** (`H5000M-CI-Qmodem-OP`), not a vendor image. That
  repository already knows how to pull an external package repository in as a feed, so both priorities are reachable
  without changing how the firmware is produced:
  1. **APK package feed** (chosen first) — GitHub Pages serves the signed index; the device adds one line and updates
     with `apk upgrade`.
  2. **Source feed** (chosen second) — the CI installs this repository as a feed and compiles it into the image, so a
     freshly flashed router already has the menu entry.
- Baking still costs a full firmware flash, so the package feed stays the day-to-day update path even after the source
  feed exists.

## Hosting on GitHub Pages

Decision (2026-11-24): host the repository on GitHub. The layout below is served as plain static files.

```
repo/
  aarch64_cortex-a53/packages.adb
  aarch64_cortex-a53/luci-app-h5000m-pwmfan-0.1.0-r2.apk
  aarch64_cortex-a53/luci-i18n-h5000m-pwmfan-zh-cn-<stamp>.apk
  h5000m-apk.pem
  index.html
```

`sh tools/publish-apk-repo.sh` assembles exactly that directory from the working tree: it clears stale artefacts, builds
both packages with the repository key, signs them, writes `packages.adb` with `mkndx`, and copies the public key and a
small index page. The local run printed `Index has 2 packages`.

`sh tools/publish-apk-repo.sh --push` additionally commits the directory to a `gh-pages` branch through a detached
worktree, so the working tree is never touched. It needs `origin` to point at the GitHub repository; **nothing has been
pushed yet** — this checkout has no remote and no `gh-pages` branch.

One-time GitHub setup (user, once the repository exists):

1. Settings → Pages → Source: *Deploy from a branch*, branch `gh-pages`, folder `/`.
2. The feed line for a device is then
   `https://<owner>.github.io/<repo>/aarch64_cortex-a53/packages.adb`.
3. The repository must be public — Pages for a private repository needs a paid plan, and the package content is public
   anyway.

Client side on the router (verified on the device against its own uhttpd; the same files over Pages differ only by TLS):

```sh
wget -O /etc/apk/keys/h5000m-apk.pem https://<owner>.github.io/<repo>/h5000m-apk.pem
echo https://<owner>.github.io/<repo>/aarch64_cortex-a53/packages.adb >> /etc/apk/repositories.d/customfeeds.list
apk update && apk add luci-app-h5000m-pwmfan
```

The device carries `ca-bundle` and `/etc/ssl/certs/ca-certificates.crt`, and `wget` against
`https://downloads.immortalwrt.org/…` succeeds, so HTTPS hosting is reachable from the router.

## Source feed for the custom firmware

The firmware repository `H5000M-CI-Qmodem-OP` (`E:\WorkSpace\A20_Project\H5000M-CI-Qmodem-OP-git`) builds snapshots with
GitHub Actions and already handles external packages:

- `Scripts/Packages.sh` clones extra repositories and registers them as feeds with `src-link` plus
  `./scripts/feeds update <name> && ./scripts/feeds install -a -p <name>`.
- QModem and Model Pro use that path. The Model Pro block documents the single-package trap verbatim: a repository
  whose `Makefile` sits at the tree root cannot be used as a feed directly, because `scripts/feeds` requires
  `feed_dir/<pkg>/Makefile`, and the scan misreads the root Makefile (`target pattern contains no '%'`, later
  `No feed for package`). The workaround is to copy the build inputs into `../<feed>-feed/<pkg>/` and register that
  directory with `src-link`.

This repository has the same single-package shape (root `Makefile`, `root/`, `htdocs/`, `po/`), and its `Makefile` is a
plain luci.mk package (`include $(TOPDIR)/rules.mk` … `include $(TOPDIR)/feeds/luci/luci.mk`), so both routes work:

**A. Copy like Model Pro (smallest change).** After
`UPDATE_PACKAGE "h5000m-pwmfan" "<owner>/h5000m-pwmfan" "main"`, copy `Makefile`, `root`, `htdocs`, `po` into
`../h5000m-feed/luci-app-h5000m-pwmfan/`, move the clone out of `package/`, append `src-link h5000m <abs path>` to
`feeds.conf`/`feeds.conf.default` (feed names allow only `[A-Za-z0-9_]`), then
`./scripts/feeds update h5000m && ./scripts/feeds install -a -p h5000m`. Select
`CONFIG_PACKAGE_luci-app-h5000m-pwmfan=y` and, for the translation,
`CONFIG_PACKAGE_luci-i18n-h5000m-pwmfan-zh-cn=y`.

**B. Publish a real feed repository.** A second repository whose root contains `luci-app-h5000m-pwmfan/` can be used as
`src-git h5000m https://github.com/<owner>/h5000m-feed.git` without the copy step. It costs a sync workflow and a second
repository, so it is only worth it when more than one firmware tree consumes the package.

Either way the firmware build compiles the package from source — the same code path the previous fan controller used,
since `/rom/lib/apk/db/installed` records `o:feeds/base/luci-app-h5000m-fancontrol`. That build has the full source
tree, so it needs no SDK.

## The SDK question

- The downloadable binary SDK (`immortalwrt-sdk-mediatek-filogic_gcc-14.4.0_musl`, `r42542-e695009c15`) is finished as a
  *build host for this package*: the attempt to pin LuCI removed the `ucode` staging marks and the archive does not
  carry them either, while `package/libs` sources are absent, so `make package/…/compile` cannot run again.
- It is not needed. This package ships files only (`root/`, `htdocs/`, `po/`); `tools/build-apk.sh` produces a payload
  that matches the SDK-built package file for file, and the firmware build compiles the same package from source.
- A *matching* SDK is still obtainable if it is ever wanted: build it from the same tree (`CONFIG_SDK=y`, then `make`;
  artefact under `bin/targets/`) instead of downloading one. That costs a full toolchain build; nothing in the current
  plan requires it.
- `luci.mk` is identical between the SDK's `ebc4118b71` and the device's `ad75cde`, so the revision difference never
  mattered for this package.

## Update path

The manual loop stays until the repository is published: `sh tools/build-apk.sh` → `scp build/*.apk` → `apk add
--allow-untrusted --force-overwrite` → clear LuCI caches. After publishing, the last step becomes `apk update && apk
upgrade`.
