# Development tools

This package keeps its engineering toolchain small and portable. The package
itself targets OpenWrt and is built with an OpenWrt SDK on Linux or in CI.

## Required checks

- `shellcheck`: lint `/bin/sh` controller and procd scripts.
- `shfmt`: format shell scripts with LF line endings.
- `bats`: run isolated controller tests with fake sysfs and temperature files.
- `dtc`, `fdtdump`, and `fdtget`: inspect and validate H5000M device trees.
- OpenWrt SDK: build the IPK and verify package metadata and dependencies.

The WSL development environment installs these tools from Ubuntu packages. Do not add platform-specific binaries to this repository. Use the matching OWT2510 buildroot or SDK for package builds.

## Suggested local commands on Linux/CI

```sh
STRICT=1 sh tools/check.sh
make package/luci-app-h5000m-pwmfan/compile V=s
```

Device-tree inspection remains a separate compatibility check because it needs
the target firmware's DTB and must preserve CPU passive, hot, and critical
protection.


## Vantage preview

Serve the actual package views alongside the LuCI and Vantage assets from an
extracted firmware root. The launcher uses an isolated in-memory RPC fixture,
so changes in the preview apply only to that server session.

```sh
python3 tools/preview.py /path/to/extracted-rootfs --port 8028
```

Open `http://127.0.0.1:8028/`. The dashboard links to Advanced Settings and
supports automatic, light, and dark themes. `msgfmt` provides the preview
translation catalog. The real package uses the standard LuCI translation build.

With Playwright installed, run `node tests/preview.mjs` against a fresh preview
server. Use `PWMFAN_PREVIEW_URL` to select the server and
`PWMFAN_PREVIEW_OUTPUT` to save screenshots.
