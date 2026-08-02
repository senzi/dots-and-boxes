# D63V1 调试协议

## 回放码

```text
D63V1.<frontier-base36>.<seed-base36>.<display-step-base36>.<opening-edges>
```

其中：

- `frontier-base36`：142 位前沿 mask 的 base36 表示；
- `seed-base36`：生成前沿时使用的无符号 32 位 seed；
- `display-step-base36`：当前显示到第几个价值块；
- `opening-edges`：每个价值块的开边编号，base36，以 `-` 分隔；零步使用 `_`。

价值块内部的自动吃边无需写入协议，因为它由前沿和开边通过确定性闭包重新计算。开边序列用于检测算法版本变化。

## 一键复制调试包

`value-lab.html` 的“一键复制当前块全部信息”输出：

```text
D63 VALUE DEBUG v1
protocol=D63V1....
frontier=D63F1....
display_block=...
parity=...
block=...; value=...; handout=...
opening=...
boxes=...
capture_edges=...
handout_edge=...
analysis=exact:...; nodes:...; ...
```

用户只需把整段文本交给 Codex，并说明“这一块价值/让法有问题”。

## 复算

浏览器：打开 `protocol-inspector.html`，粘贴整段调试包。

命令行：

```powershell
node tools/inspect-protocol.mjs "D63V1...."
```

如果协议记录的开边与当前算法重算结果不同，检查器输出 `MISMATCH`。这通常意味着算法排序或价值定义已经改变，应更新协议版本或迁移规则。
