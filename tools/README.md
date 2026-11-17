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

