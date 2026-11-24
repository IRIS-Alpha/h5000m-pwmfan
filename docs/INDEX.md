# 文档索引

本仓库只有一个需求基线文档，其余文档要么是实现记录，要么是操作手册。按下面的顺序读，就不必猜哪份是最新的。

## 先读这些

1. [`README.md`](../README.md) —— 这个包是什么、怎么装、仓库怎么摆（中文为默认版本，
   英文见 [`README.en.md`](../README.en.md)，两页顶部可互跳）。
2. [`REQUIREMENTS_V5.md`](REQUIREMENTS_V5.md) —— **唯一**的需求基线。冲突时以它为准。
3. [`TASKS.md`](TASKS.md) —— 进度、验收块、待办与已定案的决策简报。
4. [`RUNTIME_EVIDENCE.md`](RUNTIME_EVIDENCE.md)（中文版 [`RUNTIME_EVIDENCE.zh-CN.md`](RUNTIME_EVIDENCE.zh-CN.md)）—— 设备上实测到的行为，回答“凭什么说它会这样跑”。
5. [`ROLLBACK.md`](ROLLBACK.md)（中文版 [`ROLLBACK.zh-CN.md`](ROLLBACK.zh-CN.md)）—— 出问题时按级退回。

## 版本编号对照

| 编号 | 是什么 | 状态 |
| --- | --- | --- |
| V1 | 最早的需求草稿（`archive/REQUIREMENTS_v1.md`） | 已归档，结论并入 V5 |
| V3 | 2026-11-19 的界面需求基线，实现基线 `214943e` | 已改名为 V5；内容未丢，只换了版本号与抬头 |
| V4 | 跨会话续接包（`archive/HANDOFF_V4.md`、`archive/NEW_CHAT_PROMPT_V4.md`） | **不是需求版本**，是交接材料；已归档 |
| V5 | 当前唯一基线（`REQUIREMENTS_V5.md`） | 生效 |

V3 改称 V5 的原因：V4 期间的需求增量（图例即读数区、关机前重启、进程守护、高级设置九组、单位字号规则等）此前只回填进 V3 文件，版本号却没跟着动，导致“V4 续接包里写着 V3”的错位。现在合并为一份、按实际演进编号。

## 需求与决策

| 文件 | 用途 | 状态 |
| --- | --- | --- |
| [`REQUIREMENTS_V5.md`](REQUIREMENTS_V5.md) | 界面与行为需求基线，含术语约定（保护锚点、安全最高温仲裁等） | 生效 |
| [`REQUIREMENTS_IMPROVEMENT.md`](REQUIREMENTS_IMPROVEMENT.md) | 早期改进提案合集，保留决策来源 | 历史，冲突以 V5 为准 |
| [`UIUX_IMPROVEMENTS_2026-11.md`](UIUX_IMPROVEMENTS_2026-11.md) | 2026-11 的视觉问题与方案清单 | 历史记录 |
| [`UIUX_RECHECK_2026-11-22.md`](UIUX_RECHECK_2026-11-22.md) | 某次 UI/UX 复查的报告（行号对应 `96f6971`） | 快照，不随代码更新 |
| [`UI_LAYOUT.md`](UI_LAYOUT.md) | 页面结构与布局约束的早期说明 | 历史，V5 第 19 节已覆盖分组 |

## 运行时与安全

| 文件 | 用途 |
| --- | --- |
| [`RUNTIME_EVIDENCE.md`](RUNTIME_EVIDENCE.md) / [`.zh-CN.md`](RUNTIME_EVIDENCE.zh-CN.md) | 实测证据：热区拓扑、所有权与握手、请求管线、开销、释放与交棒、互相重建、仍未关闭的观察项 |
| [`ROLLBACK.md`](ROLLBACK.md) / [`.zh-CN.md`](ROLLBACK.zh-CN.md) | L1–L5 回滚手册、中止判据、回滚不恢复什么 |
| [`KERNEL_HANDOVER.md`](KERNEL_HANDOVER.md) | 内核热区接管方案与触点钉住的取舍 |
| [`RUNTIME_OWNERSHIP.md`](RUNTIME_OWNERSHIP.md) | 运行时所有权判定（谁在写 `pwm1`） |
| [`FIRMWARE_PROVENANCE.md`](FIRMWARE_PROVENANCE.md) | 目标固件的来源与硬件事实 |
| [`device-baseline-20261123.md`](device-baseline-20261123.md) | 某次设备只读快照（配置、包、触点、状态） |

## 构建、分发与集成

| 文件 | 用途 |
| --- | --- |
| [`BUILD_AND_INSTALL.md`](BUILD_AND_INSTALL.md) | 无 SDK 的打包方式、安装、私钥位置 |
| [`DISTRIBUTION.md`](DISTRIBUTION.md) | 签名 APK 仓库、GitHub Pages、源码 feed、交付方式分类 |
| [`FIRMWARE_INTEGRATION.md`](FIRMWARE_INTEGRATION.md) | 把插件编进自定义固件的 `src-git` 方案、三道守卫、故障表 |
| [`patches/`](patches) | 固件仓库的补丁（按实际应用结果生成） |
| [`design-review-20261123.md`](design-review-20261123.md) | Web 设计规范审查的结论（已修项与不改项） |

## 约定

- 需求条目只有写进 `REQUIREMENTS_V5.md` 才算定案；`TASKS.md` 里的“讨论中”不是规范。
- 实测行为变化后，先改 `RUNTIME_EVIDENCE.md`，再改需求（如果需求描述错了）。
- 历史文档（`archive/`、带日期的复查、快照）不再维护，读的时候注意抬头注明的基线提交。
