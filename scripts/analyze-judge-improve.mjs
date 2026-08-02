// 简化判断器改进：finalCtrl + 终局块大小 + 让分 → 分级判断
// 覆盖率 = 能确定判断的局占比；准确率 = 确定判断里正确的比例
// node scripts/analyze-judge-improve.mjs [数据文件]
import fs from 'node:fs'
import path from 'node:path'

const file = process.argv[2] || path.resolve('ai-research/explore/data/losing-batch.jsonl')
const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))

function finalCtrl(r) {
  let c = 1
  for (const s of r.valueSeq) {
    const choice = s.split('/')[1] || ''
    if (choice.includes('翻转')) c = 1 - c
  }
  return c
}
function terminalValue(r) {
  return Number(r.valuePlain.split(',').slice(-1)[0])
}
function giveTotal(r) {
  let g = 0
  for (const s of r.valueSeq) {
    const net = Number(s.split('/')[2])
    if (net < 0) g += -net
  }
  return g
}

// 分级判断器：finalCtrl=1 → 输；finalCtrl=0 → 终局块≥T → 赢；<T → 看让分
function judge(r, T, G) {
  const fc = finalCtrl(r)
  if (fc === 1) return { pred: 'lose', sure: true }
  const t = terminalValue(r)
  if (t >= T) return { pred: 'win', sure: true }
  const g = giveTotal(r)
  if (g <= G) return { pred: 'win', sure: true }
  return { pred: null, sure: false } // 不确定
}

console.log('=== 分级判断器（终局块阈值 T · 让分阈值 G）===')
console.log('规则：不控制终局→输；控制终局且块≥T→赢；块<T 且让分≤G→赢；否则不确定')
console.log('')
console.log(' T,G | 覆盖率 | 确定局准确率 | 不确定局(实际胜率)')
for (const [T, G] of [[10, 99], [10, 4], [10, 2], [8, 4], [8, 2], [12, 4]]) {
  let sure = 0, correct = 0, unsure = 0, unsureWin = 0
  for (const r of rows) {
    const { pred, sure: s } = judge(r, T, G)
    const actualWin = r.result === 'win'
    if (!s) { unsure++; if (actualWin) unsureWin++; continue }
    sure++
    if ((pred === 'win') === actualWin) correct++
  }
  const cov = sure / rows.length * 100
  const acc = correct / sure * 100
  const uWin = unsure ? unsureWin / unsure * 100 : 0
  console.log(` ${String(T).padStart(2)},${String(G).padStart(2)} | ${cov.toFixed(1)}% | ${acc.toFixed(2)}% | ${unsure}局(胜率${uWin.toFixed(1)}%)`)
}
