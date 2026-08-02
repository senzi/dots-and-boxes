# D63 价值块分析交付包

这是一个完全本地、无构建步骤的 8×8 缺左上角 Dots and Boxes 价值分析工具。

## 入口

- `index.html`：目录页。
- `value-lab.html`：价值块分析实验室。
- `protocol-inspector.html`：D63V1 协议独立复算页。

直接双击 HTML 即可使用。页面只加载本目录内的 CSS/JavaScript，不访问网络。

## 验证

在本目录运行：

```powershell
node tools/verify.mjs
node tools/inspect-protocol.mjs "D63V1...."
```

## 阅读顺序

接手调试的模型先阅读：

1. `docs/HANDOFF.md`
2. `docs/ALGORITHM.md`
3. `docs/PROTOCOL.md`
4. `src/value-bot.js`

当前版本只负责稳定识别价值块和控制事件，不宣称已经能够判断整盘胜负。
