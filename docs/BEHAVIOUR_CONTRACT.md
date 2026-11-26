# 行为合同

这份文件记录“装上这个包之后，风扇一定会怎样”，也就是从旧 README 里迁出来的行为约束。需求为什么这么定，看 [`REQUIREMENTS_V5.md`](REQUIREMENTS_V5.md)；怎么实测出来的，看 [`RUNTIME_EVIDENCE.md`](RUNTIME_EVIDENCE.md)。

## 默认状态

- 安装后默认 `enabled=0`、`kernel_takeover=0`：插件只读，不写 `pwm1`，不碰热区触点。状态文件会写 `state=disabled` 与具体原因（`not_enabled` / `takeover_pending` / `released`）。
- 只有同时满足 `enabled=1`、`kernel_takeover=1`、`takeover_verified=1`、找到可写 `pwm1`、且该 hwmon 带 `pwm-fan` 冷却设备时，才认为接管成立（`kernel_takeover_ready_dir()`）。任何一条不满足都不写 PWM。

## 找设备

- 按 hwmon 的 `name` 找 `pwmfan`，不假设 `hwmonN` 编号；编号会随加载顺序变。
- 内核模块 `kmod-hwmon-pwmfan` 是包依赖。
- 设备没有风扇转速反馈通道（无 `fan1_input`），所以“转速缺失”不算故障，也不会伪造 RPM。

## 请求从哪来

一轮控制里，请求依次经过：模式（固定请求 / 曲线 / 目标驱动）→ 非零请求下限 → 曲线输出上限 → 温度保护斜坡 → 启动助推。

- **非零请求下限**（`min_pwm`，默认 51/255 ≈ 20 %）只钳制非零请求；显式的 0 % 请求直接放行，视为停转。这是“显式停转”与“低占空比”两种意图的区分点。
- **曲线输出上限**（`max_pwm`，默认 255）同时约束请求、目标闭环、保护斜坡与启动助推；故障全速（255）不受它约束。
- 状态文件同时给出 `requested_pwm`（算出来的）与 `effective_pwm`（回读的），两者不一致就说明有别的写入者在场。
- `floor_pwm` / `floor_limited` 报告本轮是否被下限抬高，界面据此显示“非零请求下限”芯片；0 % 请求时 `floor_limited=0`。

## 温度与安全

- 每个控制周期采一次快照，与历史图表的采样间隔无关。
- 传感器“有效”= 文件可读且数值在 −40…150 °C；无效读数不会被当成 0 °C。
- 曲线只跟随**所选传感器**；温度保护使用**全部有效传感器中的最高值**（安全最高温仲裁），未选中的传感器不驱动曲线但仍参与保护。
- 保护链：提前区间（`protection_radius`）内开始爬升 → 到达保护锚点（`protection_temp`）锁 100 % → 低于锚点减去释放回差（`protection_release`）才解除。
- 读数短暂失效时，在 `2 × poll_interval` 内沿用上一有效值并置 `stale_temperature=1`（界面“温度过期”芯片）；超时才进 `failsafe no_valid_temperature`（100 % 全速）。
- 故障响应固定：传感器不可用或 PWM 写入失败 → 请求 100 %，没有开关。

## 接管与释放

- 接管时把 `pwm-fan` 最冷的两个 active 触点钉住（记录在 `/var/run/h5000m-pwmfan/thermal-takeover`），释放时按记录恢复。
- **释放（`enabled=0`）把通道交还内核**：切 `pwm1_enable=2`，仅在温度低于最冷风扇触点时把 `cur_state` 归零，否则保留内核档位；只有交还失败才写 255 保底。实测确认：写回触点会唤醒热区，但内核不会自己接管一个仍处于手动模式的通道——旧版“写 255 后不管”会让风扇一直全速（2026-11-26，33 °C 仍 100 %）。
- CPU 降频与 125 °C 临界关机始终属于内核，本包从不关闭它们。

## 监督

- 两个 procd 实例：控制器 `daemon` 与独立看门狗 `watchdog`，`respawn 3600 5 0`（无限重试）。
- 控制器沉默超过三个控制周期（心跳文件过期），看门狗写 255、恢复触点、必要时 KILL 控制器；控制器反向监视看门狗心跳，沉默 20 秒则终止它。心跳按状态文件里的 `uptime=` 计龄，墙钟跳变（RTC 纠正、NTP 步进）不算沉默。
- 双方都按“停住的进程收不到 SIGTERM”处理：先 TERM，4 秒后 KILL。
- 关机前重启默认关闭。开启后有两个触发点：温度停在保护锚点以上满 20 秒，或达到 `early_reboot_temp`（100…120 °C，默认 110）立即重启；后者应比 125 °C 关机触点至少低 15 °C。

## 升级与配置

- `/etc/config/h5000m_pwmfan` 是 conffile：升级保留用户配置，新键由代码默认值兜底（不会静默改写文件）。
- 包依赖 `libc` 与 `kmod-hwmon-pwmfan`；不含内核模块本体。
- 面板上“接管风扇控制”开关同时写 `enabled` 与 `kernel_takeover` 两个键，读取时取两者的与。

## 不再成立的旧说法

旧 README 里这些说法已经过期，保留在此仅作对照：

- “第一个里程碑是包后端、单页界面另立任务” —— 界面已经完成并作为主入口。
- “`make package/luci-app-h5000m-pwmfan/compile`” —— 现在用 `tools/build-apk.sh` 直接产出签名 APK，不再依赖 SDK。
- “默认曲线与 51/255 下限待定” —— 下限已由出厂测试数据确定为 20 %（8 % 起转 × 约 2.5 倍余量）。
