# 回滚与恢复

> 本文是 `docs/ROLLBACK.md` 的中文版本，供评审与现场操作阅读；两者内容一致，若有出入以英文原文为准。

本文覆盖什么：风扇插件出问题时，怎么把路由器恢复原样，以及怎么证明它确实恢复了。这正是 `docs/TASKS.md` 在评审真机 PWM 与热区改动之前要求的那份流程——插件被允许写 `pwm1`、也允许钉住两个热区触点，所以两者都需要一条**不依赖插件还能工作**的回退路径。

## 这个包到底改了什么

| 项目 | 本固件默认值 | 插件启用时 |
|---|---|---|
| `thermal_zone0/trip_point_5_temp` | 40000 | 1000（永久钉成已触发） |
| `thermal_zone0/trip_point_4_temp` | 85000 | 114000（第三冷触点 − 1000） |
| `pwm1`（`/sys/devices/platform/pwm-fan/hwmon/hwmon2/pwm1`） | 内核 governor | 插件，每个控制周期 |
| `thermal_zone0/policy` | `step_wise` | 若被人改成 `user_space` 则修回 `step_wise` |
| 文件 | — | `/usr/sbin/h5000m-pwmfan*`、`/usr/lib/h5000m-pwmfan/`、LuCI 视图、翻译目录、`/etc/config/h5000m_pwmfan` |

原始触点在写入任何东西之前先记到 `/var/run/h5000m-pwmfan/thermal-takeover`。设备上现在这个文件的内容是 `v1 5 40000 4 85000`，即**trip 5 原为 40 °C、trip 4 原为 85 °C**。

## 先取快照

```sh
ssh root@192.168.10.1 'sh -s' < tools/device-snapshot.sh > /tmp/router-before.txt
```

这个脚本只读。它打印配置、包列表、状态文件、每个 `hwmon` 输入、每个热区触点与冷却设备绑定、文件哈希以及最后几行日志；这正是事后对比所需要的全部内容。`docs/device-baseline-20261123.md` 就是一份这样的快照。

## L1——释放控制（常规回滚）

```sh
uci set h5000m_pwmfan.main.enabled='0'
uci commit h5000m_pwmfan
/etc/init.d/h5000m-pwmfan restart
```

下一个控制周期看到 `enabled != 1`，就会调用 `thermal_takeover_restore()` 与 `release_fan()`。预期结果是：

```sh
cat /var/run/h5000m-pwmfan/status      # state=disabled reason=released
cat /sys/class/thermal/thermal_zone0/trip_point_5_temp   # 40000
cat /sys/class/thermal/thermal_zone0/trip_point_4_temp   # 85000
ls /var/run/h5000m-pwmfan/thermal-takeover               # 已删除
```

释放会**故意**把 **255** 写入 `pwm1`，所以释放后风扇是全速运行的。2026-11-24 实测（见 `docs/RUNTIME_EVIDENCE.md`）：恢复触点确实会让内核重新评估热区，`cooling_device0/cur_state` 在那一刻跳到最大值（3），**但内核随后并不调节占空比**——手动写入的 51 在热区停在最低触点的情况下保持了二十秒，没有任何东西把它顶回去。

因此释放后的风扇会一直保持 255，直到插件重新启用或路由器重启。这在热上是安全的（最大冷却）、声音很明显；它不是受控交棒，所以不要等风扇自己慢下来。

`kernel_takeover` 不需要改：它只控制“是否允许接管”，而 `enabled=0` 已经释放了控制。

## L2——手动解钉触点

适用于守护进程已经没了（被杀、被卸载、包损坏）但触点仍然钉着的情况。先停服务，否则下一个周期可能又把它钉回去：

```sh
/etc/init.d/h5000m-pwmfan stop
read -r version cold_index cold_temp next_index next_temp \
	< /var/run/h5000m-pwmfan/thermal-takeover
echo "$next_temp" > /sys/class/thermal/thermal_zone0/trip_point_${next_index}_temp
echo "$cold_temp" > /sys/class/thermal/thermal_zone0/trip_point_${cold_index}_temp
rm -f /var/run/h5000m-pwmfan/thermal-takeover
```

**先**恢复较高的那个触点——插件自己也这么做——这样热区不会在某一刻同时持有两个冷触点。

如果状态文件已经没了，原值就从内存里丢了；用改动之前的快照（`docs/device-baseline-20261123.md` 记的同样是 `v1 5 40000 4 85000`），或者重启让固件恢复。

## L3——卸载这个包

```sh
apk del luci-app-h5000m-pwmfan luci-i18n-h5000m-pwmfan-zh-cn
```

卸载后会留下：`/etc/config/h5000m_pwmfan`（作为 conffile 有意保留，重装时设置还在）、重启前的 `/var/run` 文件，以及日志。我们发布的 APK 没有用设备信任密钥签名，所以重装需要 `apk add --allow-untrusted`——见 `docs/BUILD_AND_INSTALL.md`。

## L4——回到旧的控制器

旧的 `luci-app-h5000m-fancontrol` 已于 2026-11-23 卸载。它的文件在设备和本机工作区都有备份：

```sh
md5sum /root/h5000m-backup/legacy-fancontrol-20261123.tgz   # 09ba65f4c580663e0585250a7dd5d087
tar -xzf /root/h5000m-backup/legacy-fancontrol-20261123.tgz -C /
/etc/init.d/h5000m-fancontrol enable
/etc/init.d/h5000m-fancontrol start
```

工作区副本在 `C:\Users\31190\ego-h5000m\device-backup\`。**不要同时跑两个控制器**：先卸载或停用本包（`L1` + `L3`）。

## L5——重启与固件

触点温度存在于内核内存里，所以重启会把它们恢复成固件默认值；`/var/run`（tmpfs）也会连同原始值的记录一起忘掉。因此重启是“粗暴复位”，不是“安全释放”：如果 `enabled=1` 与 `takeover_verified=1` 仍然设着，守护进程会在启动几秒后重新钉住触点。

如果想让插件保持安装但在重启后不动作，**在重启之前**先执行 `L1`。

以上任何一步都不改动固件本身。如果路由器要回到出厂系统，用厂商镜像做 sysupgrade；如果设置以后还要用，先备份 `/etc/config/h5000m_pwmfan`。

## 真机测试的中止判据

出现以下任一情况，立即停止测试并执行 `L1`：

- 状态文件里出现 `state=fault`，或 `logread | grep h5000m-pwmfan` 显示一个周期内没有清除的 failsafe；
- `pwm1` **自己往下走**，而温度在热区没有要求的情况下继续爬升（释放后风扇保持 255 是预期行为，不算故障）；
- 释放后触点温度没有回到 40000 / 85000；
- `requested_pwm` 大于 0 时风扇停转（风扇才是被保护的对象；安静的停转比高速运转更糟）。

## 回滚不恢复什么

- `thermal_zone0/policy` 保持 `step_wise`。插件会把 `user_space` 修成 `step_wise` 而不会改回去；旧控制器已经不在了，`step_wise` 是风扇唯一剩下的所有者，回滚也应该落在这里。只有在另一个用户态控制器正在运行时，才手工把它设回 `user_space`。
- `pwm1` 是最后一个写入者留下的值。释放后是 255，并保持到插件再次写入或路由器重启。
- 保护历史与温度历史文件（它们是运行时数据）。
- `/etc/config/h5000m_pwmfan`——除非你删掉它。
