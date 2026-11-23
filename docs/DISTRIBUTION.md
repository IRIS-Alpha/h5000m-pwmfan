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

The line in `customfeeds.list` must point at **the index file itself**. A directory is accepted by the parser but apk
then probes `<dir>/aarch64_cortex-a53/APKINDEX.tar.gz` (the v2 layout) and fails with `1 unavailable`.

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

1. **Hosting.** Nothing is published yet. The user reviews the repository contents and the cleanup (no keys, no build
   directories) before it goes live.
2. **Version bumping.** `PKG_RELEASE` in `Makefile` and `RELEASE` in `tools/build-apk.sh` must move together; the
   translation package derives its version from the build clock instead.

## Update path

The manual loop stays until the repository is published: `sh tools/build-apk.sh` → `scp build/*.apk` → `apk add
--allow-untrusted --force-overwrite` → clear LuCI caches. After publishing, the last step becomes `apk update && apk
upgrade`.
