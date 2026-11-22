# Firmware provenance for `r0-a4ba824`

Recorded 2026-11-22 while closing the tracker item “Recover an authoritative CI run/release record or pinned
source and feed revisions for firmware `r0-a4ba824`”.

## What the device reports

```
DISTRIB_ID='ImmortalWrt'
DISTRIB_RELEASE='SNAPSHOT'
DISTRIB_REVISION='r0-a4ba824'
DISTRIB_TARGET='mediatek/filogic'
DISTRIB_ARCH='aarch64_cortex-a53'
DISTRIB_TAINTS='no-all'
```

`/etc/openwrt_release` carries mtime `2026-11-14 11:42` (+08:00). ImmortalWrt builds reproducibly with
`SOURCE_DATE_EPOCH` taken from the source commit, so the timestamp is the commit time, not the build time.

## The hash is an upstream commit, not a commit of the firmware repository

`git cat-file -t a4ba824` in `H5000M-CI-Qmodem-OP-git` fails, which is expected: the workflows clone the source at
build time (`.github/workflows/WRT-CORE.yml:315`, `git clone --depth=1 --single-branch --branch "$WRT_BRANCH"
"$WRT_REPO"`), so `DISTRIB_REVISION` describes the upstream tree, not this repository.

Verified through the GitHub API (`GET /repos/immortalwrt/immortalwrt/commits/a4ba8240d`, HTTP 200):

| Field | Value |
| --- | --- |
| Commit | `a4ba8240d8a1aaef7e8c6f2d65e841a9bfd2b8c5` |
| Subject | `Merge Official Source` |
| Author / date | Tianling Shen, `2026-11-14T03:42:48Z` (11:42 +08:00) |
| Parents | `d42cc475c60e`, `e2ed57b957dc` |

`WRT-CORE.yml:449` already refers to the same commit (“官方源 11-14 的 Merge Official Source（a4ba8240d）”), because it
moved `firewall4` to `2026.11.08~3722eadc` and broke the fullcone patch context.

## Candidate CI run

| Field | Value |
| --- | --- |
| Repository | `IRIS-Alpha/H5000M-CI-Qmodem-OP` |
| Run | `43568494545` (`.github/workflows/WRT-BUILD.yml`) |
| Trigger | `workflow_dispatch`, branch `codex/upstream-rebuild` |
| Head commit | `09a2fcfb04f5f7fc6f829e3fe2fdf8c9b50507d6` (“merge: sync upstream Ubuntu 26.04 CI fixes”, 2026-11-14 14:49 +08) |
| Window | `2026-11-14T06:53:19Z` → `07:34:51Z`, conclusion success |
| Sibling run | `43598909066` the same day failed |

`09a2fcfb0` is an ancestor of this repository’s HEAD, so the workflow revision that ran is locally available. This is
the only successful run created on the day the source commit landed, which makes it the candidate that produced the
installed image.

## Why the record is still not authoritative

- The repository has **no GitHub releases** (`GET /releases` returns an empty list), and the run’s artifacts are gone
  (`GET /actions/runs/43568494545/artifacts` → `total_count: 0`), so the installed image cannot be matched byte for bat byte.
- The image carries no build id of its own; `DISTRIB_REVISION` only names the upstream source.
- Feed revisions (`feeds.conf.default` contents at build time) live only in the run logs, which expire.
- The head branch is `codex/upstream-rebuild`; the run was a dispatch build, so the mapping from “installed image” to
  “run” rests on timing rather than on a recorded identifier.

## Consequence for this plugin

The SDK available locally is the October snapshot; the device runs a November source tree. APKs built here install
with `--allow-untrusted` because they are not signed with the device trust key, which is why the local install path
uses `apk add --allow-untrusted --force-overwrite`. A fully reproducible device image would need a build from
`a4ba8240d` with the package feed pinned to the same revision.
