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
| `/etc/apk/repositories` | **absent** — every install so far was a manual `apk add --allow-untrusted /tmp/…apk` |
| Trusted keys | `/etc/apk/keys/{immortalwrt-snapshots,openwrt-snapshots,public-key}.pem`, EC P-256, 178 B each |

The three keys belong to the firmware builds. We cannot sign with them, and a
repository signed with a key the device does not know is refused exactly like an
unsigned one — so publishing our own public key is part of the install instructions,
not an afterthought.

## Layout

```
repo/
  packages/
    luci-app-h5000m-pwmfan-0.1.0-r2.apk
    luci-i18n-h5000m-pwmfan-zh-cn-….apk
  APKINDEX.adb            # v3 index; file name to confirm, see below
  h5000m-apk.pem          # our public key, for /etc/apk/keys/
  h5000m-apk.pem.sha256
```

Client side, once the trust question is settled:

```sh
wget -O /etc/apk/keys/h5000m-apk.pem https://<host>/apk/h5000m-apk.pem
echo 'https://<host>/apk/aarch64_cortex-a53' >> /etc/apk/repositories
apk update && apk add luci-app-h5000m-pwmfan
```

## Tooling, verified on the build host

The SDK's host `apk` (3.0.5, `staging_dir/host/bin/apk`) is a full copy of the
package manager, so the repository can be built offline:

- `apk mkndx --allow-untrusted -o APKINDEX.adb *.apk` builds a v3 index and reports
  `Index has N packages (of which M are new)`.
- `apk adbsign --sign-key <private.pem> --reset-signatures <apk>` rewrites the
  signature in place and keeps the payload (45,807 → 45,801 B in the test).
- `apk adbdump <file>` prints the block structure; the signature record is the last
  line of the dump.
- The device's own `apk` has no `mkndx`/`adbsign`, so index building has to happen on
  the host. That is expected and is why the file is committed/prebuilt rather than
  generated on the router.

Two traps found while testing:

1. **`adbsign` without `--allow-untrusted` truncates the package.** Our SDK APKs
   carry a signature from a key we do not have, so `adbsign` stops at the existing
   signature and leaves a 1,970-byte stub in place of a 45,807-byte package — it
   prints no error and returns 0. Always pass `--allow-untrusted`, then verify the
   file size.
2. **`mkndx` refuses packages whose signature it cannot check.** Same flag is
   required there, otherwise the index is not written and only
   `ERROR: … UNTRUSTED signature` is printed.

## Open before publishing

1. **Key format for trust.** A key made with `openssl ecparam -name prime256v1` is
   accepted by `adbsign` (the dump shows a new 16-byte key id) but
   `apk verify --keys-dir <dir>` still says `UNTRUSTED`, and the id matches none of
   SHA-256 / SHA-1 / MD5 over the PEM, the SPKI DER, or the raw EC point. Until the
   encoding OpenWrt's build uses is reproduced, a package we sign cannot be checked
   by the device. Fallback while this is open: keep
   `apk add --allow-untrusted` and pin the file by its `sha256` in the instructions.
2. **Index file name.** Whether apk 3.0.5 asks for `APKINDEX.adb` or `packages.adb`
   in a repository it has not seen before is untested; a scratch `--root` would not
   initialise its database on this host, so the check needs a real root or the
   device itself.

Both are one-sitting checks on the device; neither blocks the current manual install
path, which is what the router runs today.

## Update path

Until the repository exists, an update is the same loop as today:
`deploy2.sh` (build → `scp` → `apk add --allow-untrusted --force-overwrite` → i18n
catalogue → LuCI caches → `rpcd` restart). After publishing, the same loop only
changes the last two steps to `apk update && apk upgrade`.
