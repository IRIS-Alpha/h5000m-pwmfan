# 把风扇插件接进自定义固件的编译链

目标仓库：`E:\WorkSpace\A20_Project\H5000M-CI-Qmodem-OP-git`（imm-qmodenext 分支）。
补丁：`docs/patches/0001-fan-plugin-from-a-feed.patch`（5 个文件，`git apply` 已验证可干净应用）。

## 为什么要改

插件以前是编完固件再 `scp` 上去，设备上的包因此没有来源、不能升级、也不能随固件重建。
这里把它变成编译链里的一等公民：固件树加一行 feed，配置里打开两个符号，包就跟着镜像走。

## 补丁做了什么

| 文件 | 改动 |
|---|---|
| `Scripts/Packages.sh` | 新增 `REGISTER_H5000M_FEED()`：往 `../feeds.conf`（不存在则 `feeds.conf.default`）追加 `src-git h5000m https://github.com/IRIS-Alpha/h5000m-pwmfan.git`，再 `scripts/feeds update/install -a -p h5000m`；在 QModem 分支之后按 `case "${WRT_CONFIG}" in *H5000M*)` 调用 |
| `Config/H5000M-qmodem-next.txt`<br>`Config/H5000M-qmodem.txt`<br>`Config/H5000M-modem-pro.txt` | `luci-app-h5000m-fancontrol=n`，改为 `luci-app-h5000m-pwmfan=y` + `luci-i18n-h5000m-pwmfan-zh-cn=y` |
| `.github/workflows/WRT-CORE.yml` | 在收集 manifest 之后加守卫：H5000M 变体的 manifest 必须含 `luci-app-h5000m-pwmfan`，否则 `::error::` 并退出 |

三个变体都是 H5000M 硬件，所以都换了；AP3000M / X86 配置不匹配 `*H5000M*`，既不会克隆仓库也不会打开符号。

## 为什么是 src-git，而不是 UPDATE_PACKAGE 或 src-link

- **不能 `UPDATE_PACKAGE`**：它把仓库克隆进 `package/`，包就变成 core package，`scripts/feeds install` 会以
  `Not overriding core package` 拒绝建链接，`CONFIG_PACKAGE_…` 随后被 defconfig 静默丢弃。QModem 段落里记的
  `target pattern contains no '%'` 也是同一类坑。
- **不必 `src-link` + 复制**：剪贴板方案是给"仓库顶层有 Makefile、包藏在子目录"的仓库用的。我们的仓库已经是
  feed 形状（顶层 `luci-app-h5000m-pwmfan/Makefile`），`src-git` 一行就够，固件侧没有胶水代码要维护。
- **`src-git` 的失败面最小**：上游改动只影响插件仓库，固件侧只有一条 URL；插件坏了就回退到上一个 tag，
  不需要碰固件仓库。

## 两道守卫

1. **符号层（已有，免费）**：`Scripts/check_defconfig.py` 会逐个核对 `.config.requested` 里的 `=y` 符号在
   defconfig 之后是否仍为 `y`。只要配置里写了 `CONFIG_PACKAGE_luci-app-h5000m-pwmfan=y`，被静默丢弃会直接报错。
2. **产物层（新增）**：manifest 是"包真的进了镜像"的唯一证据。符号活着但包没被打进去（依赖缺失、包被
   `provides` 顶掉）只有 manifest 能发现。

## 怎么应用

```sh
cd /path/to/H5000M-CI-Qmodem-OP-git
git apply --check docs/patches/0001-fan-plugin-from-a-feed.patch   # 先干跑
git apply        docs/patches/0001-fan-plugin-from-a-feed.patch
git apply -R     docs/patches/0001-fan-plugin-from-a-feed.patch    # 撤回
```

## 构建后怎么确认

- 构建日志出现 `h5000m: 已注册为 src-git feed 并安装到 package/feeds/h5000m/`；
- `wrt/package/feeds/h5000m/luci-app-h5000m-pwmfan` 是符号链接（指向 `feeds/h5000m/…`）；
- `bin/targets/*/*.manifest` 里有 `luci-app-h5000m-pwmfan - 0.1.0-r2`；
- 刷机后 LuCI 出现「风扇」菜单，`/etc/config/h5000m_pwmfan` 带着默认值。

## 出了问题时

| 现象 | 处理 |
|---|---|
| `feeds install` 报找不到包 | 检查 `feeds.conf` 里的 `src-git` 行与仓库顶层目录名是否仍是 `luci-app-h5000m-pwmfan/` |
| 编译报 `kmod-hwmon-pwmfan` 不可用 | 该内核模块没被做成独立包；把依赖降回 `+luci-base`，或确认固件已在内核里编入 `pwm-fan` |
| `check_defconfig` 报符号丢失 | 看它打印的 `requested vs defconfig` 对照，通常是 feed 没注册成功或依赖缺失 |
| 想要立刻恢复旧插件 | 撤回补丁里对应 `Config/*.txt` 的两行即可（`fancontrol=y` + `pwmfan` 全删），不必改脚本 |

插件本身与固件树的 LuCI 版本无关：包只安装 `root/`、`htdocs/`、`luci/i18n` 文件，不编译任何 C 代码，
所以不需要把 LuCI feed 钉到设备上的 `ad75cde`。
