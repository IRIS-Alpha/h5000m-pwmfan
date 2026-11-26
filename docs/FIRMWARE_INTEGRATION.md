# 把风扇插件接进自定义固件的编译链

目标仓库：`E:\WorkSpace\A20_Project\H5000M-CI-Qmodem-OP-git`（`imm-qmodenext` 分支）。
补丁：`docs/patches/0001-fan-plugin-from-a-feed.patch`（7 个文件，`git apply --check` 与 `git apply -R --check` 都已验证）。
状态：2026-11-24 已应用到目标仓库，提交 `218e31e3f`（**尚未推送**）。

## 为什么要改

插件以前是编完固件再 `scp` 上去，设备上的包因此没有来源、不能升级、也不能随固件重建；
而镜像里原本还带着另一个插件 `luci-app-h5000m-fancontrol`，它和本插件抢同一路 `pwm1`。

这次做两件事：把旧插件从编译链里摘掉，把本插件变成编译链里的一等公民——
固件树加一行 feed，配置里打开两个符号，包就跟着镜像走。

## 旧插件是怎么进来的

`Scripts/Packages.sh` 里原本有一行 `UPDATE_PACKAGE "luci-app-h5000m-fancontrol" "FAN789/luci-app-h5000m-fancontrol" "main"`：
先删掉 `feeds/luci`、`feeds/packages` 里同名目录，再把仓库克隆进 `package/`。设备上
`/lib/apk/db/installed` 记的 `o:feeds/base/luci-app-h5000m-fancontrol` 是那个包 Makefile 里
写死的 origin 字符串，不是它真正的落地位置。

补丁删掉这一行（换成一句指向本 feed 的注释），并在三个 H5000M 配置里把
`CONFIG_PACKAGE_luci-app-h5000m-fancontrol` 显式写成 `n`——克隆没了，符号也不会再被谁打开。

## 补丁做了什么

| 文件 | 改动 |
|---|---|
| `Scripts/Packages.sh` | ① 删掉 FAN789 那行 `UPDATE_PACKAGE`；② 新增 `REGISTER_H5000M_FEED()`：往 `../feeds.conf`（不存在则 `feeds.conf.default`）追加 `src-git h5000m https://github.com/IRIS-Alpha/h5000m-pwmfan.git`，再 `scripts/feeds update/install -a -p h5000m`；在 QModem 分支之后按 `case "${WRT_CONFIG}" in *H5000M*)` 调用 |
| `Config/H5000M-qmodem-next.txt`<br>`Config/H5000M-qmodem.txt`<br>`Config/H5000M-modem-pro.txt` | `luci-app-h5000m-fancontrol=n`（保留，防它从别处再进来），`luci-app-h5000m-pwmfan=y` + `luci-i18n-h5000m-pwmfan-zh-cn=y`；另加两行 `# CONFIG_FEED_h5000m is not set` / `# CONFIG_FEED_qmodem is not set`（见下一节） |
| `Scripts/check_defconfig.py` | H5000M 的必备符号从旧的 `luci-app-h5000m-fancontrol` 换成 `luci-app-h5000m-pwmfan`，并加一条 `kmod-hwmon-pwmfan`（`pwm1` 所在的 `pwm_fan` 模块） |
| `.github/workflows/WRT-CORE.yml` | 在 **Package Firmware** 步骤、删 manifest 之前加守卫：H5000M 的 manifest 必须含 `luci-app-h5000m-pwmfan`，否则 `::error::` 并退出 |
| `README.md` | 功能点里的旧包名换成 `luci-app-h5000m-pwmfan` 与实际能力描述（固件仓库后来整体重写 README，所以补丁不再包含这个文件，避免覆盖它自己的改版） |

三个变体都是 H5000M 硬件，所以都换了；AP3000M / X86 配置不匹配 `*H5000M*`，既不会克隆仓库也不会打开符号，
它们自己的 `luci-app-airpi-fancontrol` 逻辑一行没动。

## 两条 `# CONFIG_FEED_… is not set` 是干什么的

`include/feeds.mk` 为每个“已安装、且 `CONFIG_FEED_<name>` 为真”的 feed 往镜像里的
`/etc/apk/repositories.d/distfeeds.list` 写一行 `%U/packages/%A/<feed>/packages.adb`
（`%U` = `downloads.immortalwrt.org/snapshots`，`%A` = `aarch64_cortex-a53`），而 `scripts/feeds`
给每个 feed 生成的 `config FEED_<name>` 默认是 `y`。官方五个 feed 在下载站有二进制仓库；
我们这两个是源码 feed（`src-git` / `src-link`），下载站从来没有对应目录，于是设备上多出两条 404：

| 命令 | 带这两行 | 不带 |
|---|---|---|
| `apk update` | 返回 **2**（`2 unavailable, 0 stale`） | 返回 0 |
| `apk upgrade` | **拒绝执行**，rc=99，要求 `--force-missing-repositories` | 正常执行 |
| `apk add <包名>` | 正常 | 正常 |

构建期完全不访问这些 URL——两个 feed 的包是从源码 `feeds install` 进 `package/feeds/` 再编的——所以影响只在设备运行时。
它不是“多一行警告”，而是把系统级 `apk upgrade` 整个挡住。三条 H5000M 配置各加两行声明为未设置；
写 `FEED_<name>=m` 会让那两行变成注释，效果相同并保留可读性，两种写法任选。

## 为什么是 src-git，而不是 UPDATE_PACKAGE 或 src-link

- **不能 `UPDATE_PACKAGE`**：它把仓库克隆进 `package/`，包就变成 core package，`scripts/feeds install` 会以
  `Not overriding core package` 拒绝建链接，`CONFIG_PACKAGE_…` 随后被 defconfig 静默丢弃。QModem 段落里记的
  `target pattern contains no '%'` 也是同一类坑。
- **不必 `src-link` + 复制**：那套方案是给“仓库顶层有 Makefile、包藏在子目录”的仓库用的。我们的仓库已经是
  feed 形状（顶层 `luci-app-h5000m-pwmfan/Makefile`），`src-git` 一行就够，固件侧没有胶水代码要维护。
- **`src-git` 的失败面最小**：上游改动只影响插件仓库，固件侧只有一条 URL；插件坏了就回退到上一个 tag，
  不需要碰固件仓库。
- **与 `*-modem-pro` 兼容**：feed 行与配置无关，`feeds install` 只扫一次；包只在 `CONFIG_PACKAGE_…=y` 时进镜像。
  Model Pro 段落只在 `*modem-pro` 下跑，且只动它自己的 `../modem-pro-feed/`，两边没有交集，
  唯一代价是 Model Pro 也会多克隆几百 KB 的插件仓库。

## 三道守卫

1. **符号层**：`Scripts/check_defconfig.py` 会核对 `.config.requested` 里每个 `=y` 符号在 defconfig 之后是否仍为 `y`，
   现在它还明确要求 `luci-app-h5000m-pwmfan` 与 `kmod-hwmon-pwmfan`。被静默丢弃会直接报错。
2. **产物层**：manifest 是“包真的进了镜像”的唯一证据。符号活着但包没被打进去（依赖缺失、包被 `provides` 顶掉）
   只有 manifest 能发现，所以守卫放在 **Package Firmware** 步骤、`find … -exec rm` 删 manifest 之前。
3. **测试层**：插件仓库自己的 `tools/check.sh` 覆盖 shell、bats、翻译目录与预览回归。

## 怎么应用

```sh
cd /path/to/H5000M-CI-Qmodem-OP-git
git apply --check docs/patches/0001-fan-plugin-from-a-feed.patch   # 先干跑
git apply        docs/patches/0001-fan-plugin-from-a-feed.patch
git apply -R     docs/patches/0001-fan-plugin-from-a-feed.patch    # 撤回
```

只改了这七个路径，仓库里其它未提交的改动（`index.html`、`LICENSE` 等）不受影响。

## 构建后怎么确认

- 构建日志出现 `h5000m: 已注册为 src-git feed 并安装到 package/feeds/h5000m/`；
- `wrt/package/feeds/h5000m/luci-app-h5000m-pwmfan` 是符号链接（指向 `feeds/h5000m/…`）；
- `bin/targets/*/*.manifest` 里有 `luci-app-h5000m-pwmfan - 5.0.0-r1`，且**没有** `luci-app-h5000m-fancontrol`；
- 刷机后 LuCI 出现「风扇」菜单，`/etc/config/h5000m_pwmfan` 带着默认值。

## 出了问题时

| 现象 | 处理 |
|---|---|
| `feeds install` 报找不到包 | 检查 `feeds.conf` 里的 `src-git` 行与仓库顶层目录名是否仍是 `luci-app-h5000m-pwmfan/` |
| 编译报 `kmod-hwmon-pwmfan` 不可用 | 该内核模块没被做成独立包；把依赖降回 `+luci-base`，或确认固件已在内核里编入 `pwm-fan` |
| `check_defconfig` 报符号丢失 | 看它打印的 `requested vs defconfig` 对照，通常是 feed 没注册成功或依赖缺失 |
| manifest 守卫报错 | 包没进镜像：优先看 `feeds install` 是否真建了链接，再看 `CONFIG_PACKAGE_…` 有没有被别的配置覆盖 |
| 想要立刻恢复旧插件 | 撤回补丁，把 `UPDATE_PACKAGE` 那行与 `Config/*.txt` 的 `fancontrol=y` 一起加回去 |

插件本身与固件树的 LuCI 版本无关：包只安装 `root/`、`htdocs/`、`luci/i18n` 文件，不编译任何 C 代码，
所以不需要把 LuCI feed 钉到设备上的 `ad75cde`。
