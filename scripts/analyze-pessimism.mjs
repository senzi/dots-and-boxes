// 悲观修正评估：预测净胜 vs 实际胜率
// 若"预测净胜 1 分"的局实际胜率低 → 悲观修正有意义；若高 → 修正有害
import fs from 'node:fs'
import path from 'node:path'

const file = process.argv[2] || path.resolve('ai-research/explore/data/losing-batch.jsonl')
const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))

// 按预测净胜分组 → 实际胜率
const groups = {}
for (const r of rows) {
  const net = r.predScore[0] - r.predScore[1]
  const key = net >= 10 ? '>=10' : net >= 5 ? '5-9' : net >= 2 ? '2-4' : net >= 1 ? '1' : net >= -1 ? '0~-1' : net >= -4 ? '-2~-4' : net >= -9 ? '-5~-9' : '<-9'
  if (!groups[key]) groups[key] = { win: 0, total: 0 }
  groups[key].total++
  if (r.result === 'win') groups[key].win++
}

console.log('预测净胜（主视角-对手）→ 实际胜率:')
console.log('  预测净胜 | 胜率 | 局数')
for (const [k, v] of Object.entries(groups)) {
  console.log(`  ${k.padEnd(8)} | ${(v.win / v.total * 100).toFixed(1)}% | ${v.total}`)
}

// 悲观修正模拟：预测净胜 ≤X 判输
console.log(`\n=== 悲观修正模拟（预测净胜≤X 判输，其余判赢） ===`)
for (const X of [0, 1, 2, 3, 5]) {
  let correct = 0, wrongWin = 0, wrongLose = 0
  for (const r of rows) {
    const net = r.predScore[0] - r.predScore[1]
    const predWin = net > X
    const actualWin = r.result === 'win'
    if (predWin === actualWin) correct++
    else if (predWin) wrongWin++
    else wrongLose++
  }
  console.log(`  净胜≤${X}判输: 准确率 ${(correct / rows.length * 100).toFixed(2)}% · 误判赢(乐观) ${wrongWin} · 误判输(悲观) ${wrongLose}`)
}
