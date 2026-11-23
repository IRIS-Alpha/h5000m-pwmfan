# 运行证据

> 本文是 `docs/RUNTIME_EVIDENCE.md` 的中文版本，供评审阅读；两者内容一致，若有出入以英文原文为准。

本文收集插件在 H5000M 上实际运行时**测到**的东西，让 `docs/TASKS.md` 里“真机 PWM 与热区集成必须以经过评审的运行证据为前提”这一条有东西可评审。文中把三类陈述分开写：**实测**（有数字、有命令）、**读码**（有路径、有行号）、**报告**（用户此前手工验证过，本文没有重新测）。

回滚与恢复写在 `docs/ROLLBACK.md`；本文数字对应的设备快照是 `docs/device-baseline-20261123.md` 与 `tools/device-snapshot.sh`。

## 拓扑（2026-11-24 实测）

只有一个热区带着风扇：

```
thermal_zone0  type=cpu-thermal  policy=step_wise  temp≈46–51 °C
  cdev0 -> cooling_device0 (pwm-fan, max_state 3)  trip 3 = 115000 m°C  weight 0
  cdev1 -> cooling_device0 (pwm-fan, max_state 3)  trip 4 =  85000 m°C  weight 0
  cdev2 -> cooling_device0 (pwm-fan, max_state 3)  trip 5 =  40000 m°C  weight 0
```

三个绑定都指向同一个冷却设备；trip 4 与 trip 5 是最冷的两个，所以接管时钉住的正好是这两个。`cooling_device1` 与 `cooling_device2`（`mt7996_phy0.0/.1`）没有绑定到这个热区，因此钉住风扇触点不会推迟 PHY 降频。

风扇本身没有转速计：`hwmon2` 只暴露 `pwm1` 与 `pwm1_enable`。所以下文凡是讲占空比的地方，讲的都是写入并从 `pwm1` 读回的数值，永远不是扇叶的转速。

## 所有权

- 只有在 `enabled=1`、`kernel_takeover=1`、`takeover_verified=1`、`pwm1` 路径可写、且存在 `pwm-fan` 冷却设备时，插件才接管风扇（`kernel_takeover_ready_dir()`，`root/usr/lib/h5000m-pwmfan/controller-lib.sh:493`）。
- 接管时钉住 trip 4 与 trip 5（`thermal_takeover_apply()`，`controller-lib.sh:538`）：trip 5 变成 1000 m°C，trip 4 变成“第三冷触点 − 1000”，于是 governor 既不能要求零占空比，也不能覆盖可配置的过温策略。原始值先写进 `/var/run/h5000m-pwmfan/thermal-takeover`（格式 `v1 <冷触点号> <冷触点温度> <次冷触点号> <次冷触点温度>`）。
- 释放时按相反顺序恢复这两个触点并删除记录（`thermal_takeover_restore()`，`controller-lib.sh:570`）。写 `trip_point_*_temp` 会让内核重新评估热区，这正是释放后唤醒 `step_wise` 的原因——钉触点本身并没有留下可回滚的状态，只留下一个 governor 已经越过的触点。
- **实测**：插件持有风扇期间，`cooling_device0/cur_state` 为 `0`，`pwm1` 是插件写入的值（测量时为 51）。governor 处于空闲，没有和插件抢。
- 释放会把 255 写入 `pwm1`（`release_fan()`，`root/usr/sbin/h5000m-pwmfan:269`），所以交棒从全速开始，governor 在热区下一次更新时才把它降下来。

## 请求管线（读码）

1. `requested_pwm()`（`root/usr/sbin/h5000m-pwmfan:430`）把模式换算成占空比：`fixed:*` 用 `fixed_duty`，三个预设用 `duty_*`，其余读曲线。它输出 `<applied> <raw>` 两段。
2. 请求为 0 就保持 0；其他请求一律钳进 `min_pwm … max_pwm`。当原始请求非零且低于下限时置 `floor_limited`（第 474 行）。
3. `protection_dispatch_step()` 可以用保护斜坡或锁定覆盖请求；只有这些原因才会写 `protection_pwm`（早前一轮的证据里是第 478 行，仍是同一个 `case`）。
4. 5G 模块下限可以抬高占空比（`modem_throttle_floor`，第 601 行）。
5. 启动助推同样被钳在这条上下限之间（第 616 行）。

所以 `min_pwm` 是**请求**的下限，并不保证风扇转起来：`fixed_duty=5` 时解析出的占空比是 51/255 = 20 %，`floor_limited=1` 表示请求被抬高了。

### 为什么下限默认 20 %

`min_pwm` 默认 51/255，约 20 %：大约是让这台设备持续转动所需的 8 % 的 2.5 倍。这个差距是有意留的。用户在 2026-11-24 指出，8 % 是新风扇的出厂测试数据，默认值要给个体差异和老化的余量。风扇转不起来的区间只会随时间变大——积灰、轴承磨损、供电电压下降都会把它往上推——所以按全新风扇调出来的下限，会在寿命中途开始出现停转而**不报任何东西**，因为这块板子没有转速计。因此把下限往实测的 8 % 调，是一个有意的动作，不是微调。

## 失败路径（读码）

| 情况 | 行为 | 位置 |
|---|---|---|
| 连续两个周期没有可用的控制温度或安全温度 | 沿用上一个有效值、`stale_temperature=1`、蓝色「温度过期」芯片；超过宽限后 `failsafe no_valid_temperature` → 100 % | `apply_cycle()`，约第 552 行 |
| `pwm1` 不存在或不可写 | `fault pwmfan_not_found` → 写入 `failsafe_pwm`（255） | 第 521 行 |
| 写 `pwm1` 失败 | `fault release_write_failed` / `..._and_failsafe_write_failed`，所有权被清除 | `set_pwm()`、`release_fan()` |
| 配置非法 | `mode=invalid`、`fault invalid_configuration`；若此前持有风扇则转 100 % | `apply_cycle()` 提前返回 |
| 热区没有三个风扇触点 | 拒绝钉触点，接管停在 `takeover_pending` | `thermal_takeover_apply()` |

## 传感器仲裁（实测）

`status` 分别报告 `control_source`（喂曲线/目标）与 `safety_source`（参与安全最高温仲裁）。设备上 `sensor_sources=auto` 时，两者都指向 `hwmon1_temp1`（46.4 °C），而 trip 0（`cpu-thermal`）读到 51.3 °C——这说明它们是不同的传感器，“auto”并不等于“最热的那个”。一个来源只有在文件可读且数值落在 −40…150 °C 之内才算数。

## 开销（2026-11-24 实测，`poll_interval=2`）

40 秒 = 20 个周期，数据取自 `/proc/<pid>/stat`（守护进程的 utime+stime，子进程的 cutime+cstime）：

```
self 380 ms  children 790 ms  total 1170 ms  →  58.5 ms per cycle (19 + 39.5)
```

在默认的两秒周期下，相当于**一个核的 2.9 %**，这是第 107 轮改动之后的结果（用 `read` 取代 `cat`、缓存风扇路径、只读一次时钟、用 `/proc/uptime` 计时）。此前的基线是每周期 137 ms（6.8 %）。

内存：VMRSS 1.6 MB，VSZ 1.8 MB，单线程（在 Rust 评估中测得，见 `docs/TASKS.md`）。

## 用户报告，本文未复测

- 更换后的风扇可以从静止经启动助推转起来，然后保持转动。
- 关闭助推、关闭下限保护后，能维持转动的最低占空比是 **8 %**（从 1 % 开始，每次 1 % 步进）。
- 助推在早前的多轮对话中已多次验证。

这三条关闭了上一轮遗留的手工测试问题。它们在这里记为“报告事实”，并带一个附加说明：这块板子没有转速计，所以无法从设备上再推导一遍。

## 释放与交棒（2026-11-24 实测，用户放行的 L1 窗口）

用 `tools/l1-release.sh` 与 `tools/l1-poke.sh` 里的采样器跑了两次，每秒一个采样。两次都以恢复 `enabled=1`、重新钉回触点结束。

第一次——释放后观察 60 秒（`mode=balanced`、42.9 °C、`pwm1` 112、`cur_state` 0）：

| 时刻 | pwm1 | cur_state | trip4 / trip5 | 温度 | state |
|---|---|---|---|---|---|
| 释放前 | 112 | 0 | 114000 / 1000 | 42.9 | running |
| 释放瞬间 | 255 | **3** | 85000 / 40000 | 42.9 | disabled |
| +60 s | 255 | 3 | 85000 / 40000 | 39.9 | disabled |

第二次——释放后手动把 `pwm1` 写成 51，观察 20 秒：

| 时刻 | pwm1 | cur_state | 温度 |
|---|---|---|---|
| 释放瞬间 | 255 | 3 | 40.3 |
| 写入 51 之后 | 51 | **0** | 40.3 |
| +20 s | 51 | 0 | 40.4 |

由此确定：

- 内核**确实**会在释放时注意到风扇：触点一恢复，`cur_state` 立刻跳到最大值（3）。写触点真的会让它重新评估。
- 但内核**随后并不接管占空比**。手动写入的 51 保持了二十秒，热区就停在最低触点上（40 °C），而驱动在那次写入落地时把 `cur_state` 清零了。没有任何东西把它顶回去。
- 所以“释放”的含义是“风扇保持 100 %，直到别人再写”：热上是安全的、声音很明显，但不是受控交棒。`docs/ROLLBACK.md` 的 L1 从操作者角度写的是同一件事。
- 正常运行期间，governor 的 `cur_state` 一直是 0，是因为插件自己在写 `pwm1`；governor 并没有在和插件抢。

仍未测：governor 在剩下的那个触点（85 °C）之上会做什么。要看到它需要把 SoC 加热到 85 °C 以上，这超出了本次评审的范围。

## 进程监督（2026-11-24 新增）

上面的测量正是看门狗存在的理由：释放之后内核会恢复自己的触点并把 `cooling_device0/cur_state` 推到 3，但它再也不写 `pwm1`。所以控制器一旦挂死，风扇就停在它最后一次写入的占空比上。

- 心跳：看门狗每个轮询周期写一次 `/var/run/h5000m-pwmfan/watchdog-alive`；控制器在心跳沉默 20 秒后杀掉它（先核对 `/proc/<pid>/comm` 确认是自己人）。
- 救援：`updated_at` 过期（早于 `poll_interval × 3 + 3`）即置 `pwm1=255`、按 `thermal-takeover` 恢复内核触点、对控制器发 `SIGTERM` 让 procd 重建它。重建后的控制器会重新钉触点并继续出曲线。
- 关机前重启：默认关闭（`early_reboot=0`）；开启后有两种触发。温度停在保护阈值（`protection_temp`，默认 90 °C）以上时，用 `watchdog-hot` 计时，满 20 秒执行 `/sbin/reboot`——此时风扇已锁 100 % 却仍拉不回温度。到达重启点（`early_reboot_temp`，100…120 °C，默认 110 °C）则立即重启：125 °C 是内核关机的位置，而重启本身要跑一段时间、期间 CPU 仍在满载，所以把这段差距里的 15 °C 留给它。控制器被救援期间同样会做这项检查。
- 开销：每个轮询周期一次文件读加一次 `date`；不额外起进程。

由 `tests/watchdog.bats` 覆盖（十一项：心跳新鲜、过期、无状态文件、外来 pid、重启关闭、到达重启点立即触发、保持窗口、低于阈值清表、上下限钳制）。

## 互相重建（2026-11-24 实测）

两个方向都在路由器上用 `kill -STOP` 触发，这正是 procd 看不见的情形。

控制器被停住（风扇的持有者）：

```
t=0s   pwm1=96   trips=114000/1000  控制器 pid 623（已 SIGSTOP）
t=12s  pwm1=255  trips=85000/40000   看门狗在 9 秒宽限后动作
t=15s  控制器 pid 623 消失           SIGTERM 排队未生效，4 秒后 SIGKILL
t=21s  pwm1=93   trips=114000/1000   新控制器（pid 2740）重新钉住并恢复曲线
```

日志：`watchdog: controller silent for 11s, fan set to 255 and the controller restarted`。

看门狗被停住：

```
t=0s    看门狗 pid 752（已 SIGSTOP）
t=20s   "watchdog heartbeat is …, restarting it"   控制器发 SIGTERM
t=25s   "watchdog ignored SIGTERM, killing 752"    控制器发 SIGKILL
t=35s   看门狗 pid 2240                            procd 重新拉起
```

两条只有用 `SIGSTOP` 而不是真崩溃来模拟沉默时才会暴露的事实：被停住的进程无法响应 `SIGTERM`，所以两侧都在几秒后补一个 `SIGKILL`；procd 在五次崩溃后就不再重建实例，所以两个实例都写成 `respawn 3600 5 0`（无限）。

## 仍未关闭

- **冷启动。**用户于 2026-11-24 决定先不做。
- **governor 每一档对应的占空比。**`max_state` 是 3，设备上观察到的只有 3（255）与 0（最后写入值），所以第 1 档与第 2 档的映射仍然未知。
