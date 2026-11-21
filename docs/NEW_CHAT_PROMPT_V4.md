# 新对话续接提示（V4）

请继续开发独立 LuCI 包 `luci-app-h5000m-pwmfan`。首要工作区是 WSL Ubuntu-26.04 中的 `/home/devcc/Projects/h5000m-pwmfan`，当前基线为 `main` 分支 `b5aaed7`。不要从 Windows 侧旧包工作区恢复或覆盖代码。

开始前读取此仓库的 `AGENTS.md`、`docs/HANDOFF_V4.md`、`docs/TASKS.md`、`docs/REQUIREMENTS_V3.md`、`docs/UIUX_IMPROVEMENTS_2026-11.md` 和 `docs/UIUX_RECHECK_2026-11-22.md`，并先检查 Git 状态。以 WSL 包源码和本地构建预览为准；路由器上已安装 APK 只能作为设备部署检查，不能取代本地开发主线。

关联但独立的主固件仓库位于 `/mnt/e/WorkSpace/A20_Project/H5000M-CI-Qmodem-OP-git`（Windows：`E:\WorkSpace\A20_Project\H5000M-CI-Qmodem-OP-git`）。检查时该仓库已有未提交修改，必须保留。插件稳定前不要将其当作包工作区或擅自改动；之后仅在用户确认时将包作为 feature 接入。`/mnt/e/WorkSpace/A20_Project/H5000M-CI-Qmodem-OP-main` 不是 Git checkout，先核实再使用。SDK、解包 rootfs 与分析资料在 `/home/devcc/Projects/.h5000m-work`；其中 October SDK 不能证明与设备固件匹配。

当前工作是核查 V4 UI 改进提案，不是立即重构。逐项对照 WSL 源码和预览，记录复现、不复现或待确认，并附 viewport/theme 证据。用户要求先发现和记录问题，得到确认后再修复。已有纯样式修正及测量见 `docs/UIUX_RECHECK_2026-11-22.md`，不要重复报告。0% 请求、保存/应用模型和 3 秒模式最小间隔仍未定，不要自行定案。UI 变更需遵循本地设计/视觉检查 skill 与 Vantage 参考，完成视觉验证及适用的最终检查，并逐项更新 `docs/TASKS.md`。

本地预览命令：

```sh
python3 tools/preview.py --port 8028 /home/devcc/Projects/.h5000m-work/rootfs
```

最后记录的验证为 `STRICT=1 sh tools/check.sh`，33/33 Bats 测试通过。设备上的 PWM/thermal 接管尚未验证完成；视觉检查期间不要更改路由器实时风扇控制。
