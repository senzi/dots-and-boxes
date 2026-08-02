// 方向 1：99.3% 能判断胜负的布局特征 —— 决策规则
// 布局（价值序列）→ finalCtrl（翻转奇偶）+ 终局块值 → 主视角胜负
// node scripts/analyze-layout-rule.mjs [数据文件]
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

// 布局特征：终局块值 + finalCtrl
const groups = {}
for (const r of rows) {
  const fc = finalCtrl(r)
  const terminal = Number(r.valuePlain.split(',').slice(-1)[0])
  const key = `fc${fc}_t${terminal >= 10 ? 'ge10' : terminal >= 8 ? 'ge8' : 'lt8'}`
  if (!groups[key]) groups[key] = { win: 0, total: 0 }
  groups[key].total++
  if (r.result === 'win') groups[key].win++
}

console.log('布局特征（finalCtrl=谁控制终局 · 终局块大小）→ 主视角胜率:')
console.log('  特征 | 胜率 | 局数')
for (const [k, v] of Object.entries(groups)) {
  console.log(`  ${k.padEnd(14)} | ${(v.win / v.total * 100).toFixed(1)}% | ${v.total}`)
}

// 完整决策规则：finalCtrl + 终局块值（连续）
console.log(`\n最终控制方 + 终局块值 → 胜负:`)
const rules = [
  { name: '控制终局且终局块≥10', pred: r => finalCtrl(r) === 0 && Number(r.valuePlain.split(',').slice(-1)[0]) >= 10, expect: 'win' },
  { name: '控制终局且终局块<10', pred: r => finalCtrl(r) === 0 && Number(r.valuePlain.split(',').slice(-1)[0]) < 10, expect: null },
  { name: '不控制终局', pred: r => finalCtrl(r) === 1, expect: 'lose' }
]
for (const rule of rules) {
  const hit = rows.filter(rule.pred)
  if (!hit.length) { console.log(`  ${rule.name}: 0 局`); continue }
  const win = hit.filter(r => r.result === 'win').length
  console.log(`  ${rule.name.padEnd(20)}: ${hit.length} 局 · 胜率 ${(win / hit.length * 100).toFixed(1)}%${rule.expect ? `（规则预期 ${rule.expect}）` : ''}`)
}
