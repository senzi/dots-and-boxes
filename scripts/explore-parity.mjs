// 探索：值1/值2块数量的奇偶 vs 最终控制方（翻转奇偶决定论）
// 若 v1/v2 数量奇偶强相关 finalCtrl → 安全阶段控制数量奇偶 = 控制胜负
// node scripts/explore-parity.mjs [局数] [起始seed]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

const count = Number(process.argv[2] || 2000)
const seedBase = Number(process.argv[3] || 180000)

let rows = []
for (let i = 0; i < count; i++) {
  const mask = Frontier.generate(seedBase + i)
  const pred = Outcome.outcome(mask, 1)
  // 块级信息
  let v1 = 0, v2 = 0, flips = 0
  let c = 1
  let node = pred.tree
  for (const b of pred.blocks) {
    if (b.value === 1) v1++
    if (b.value === 2) v2++
    const choice = node ? node.choice : ''
    if (choice.includes('翻转')) { flips++; c = 1 - c }
    node = node && node.sub
  }
  rows.push({
    win: pred.score[0] > pred.score[1],
    finalCtrl: c, // 0=主视角控制终局
    v1, v2, flips
  })
}

// 奇偶 vs finalCtrl 关联表
function parityTable(name, key, rows) {
  const odd = { ctrl0: 0, total: 0 }
  const even = { ctrl0: 0, total: 0 }
  for (const r of rows) {
    const oddVal = r[key] % 2 === 1
    const t = oddVal ? odd : even
    t.total++
    if (r.finalCtrl === 0) t.ctrl0++
  }
  const acc = (a, b) => a.total ? (a.ctrl0 / a.total * 100).toFixed(1) + '%' : '-'
  console.log(`  ${name}: 奇数→主控 ${acc(odd, even)}（${odd.total}局） · 偶数→主控 ${acc(even, odd)}（${even.total}局）`)
}

console.log(`=== 值1/值2 数量奇偶 vs 最终控制方（${count} 局） ===`)
console.log('（主控=主视角控制终局；理想情况：某奇偶 100% → 主控）\n')
parityTable('值1块数', 'v1', rows)
parityTable('值2块数', 'v2', rows)
parityTable('值1+值2块数', 'v1v2', rows.map(r => ({ ...r, v1v2: r.v1 + r.v2 })))
parityTable('翻转次数', 'flips', rows)

// 用 v1+v2 奇偶直接预测最终控制方的准确率
function predictAcc(rows, key, parityCtrl0) {
  let correct = 0
  for (const r of rows) {
    const predCtrl = (r[key] % 2 === 1) === parityCtrl0 ? 0 : 1
    if (predCtrl === r.finalCtrl) correct++
  }
  return correct / rows.length * 100
}
console.log(`\n预测准确率（用数量奇偶猜最终控制方）:`)
console.log(`  值1奇偶: ${predictAcc(rows, 'v1', null) }%（需校准）`)
// 校准：找 v1 奇偶哪个对应主控
for (const [key, name] of [['v1', '值1'], ['v2', '值2'], ['flips', '翻转']]) {
  const oddCtrl = rows.filter(r => r[key] % 2 === 1 && r.finalCtrl === 0).length
  const oddTot = rows.filter(r => r[key] % 2 === 1).length
  const evenCtrl = rows.filter(r => r[key] % 2 === 0 && r.finalCtrl === 0).length
  const evenTot = rows.filter(r => r[key] % 2 === 0).length
  const oddIsCtrl0 = oddCtrl / oddTot > 0.5
  const acc = rows.filter(r => ((r[key] % 2 === 1) === oddIsCtrl0) === (r.finalCtrl === 0)).length / rows.length * 100
  console.log(`  ${name}奇偶(${oddIsCtrl0 ? '奇数→主控' : '偶数→主控'}): 预测准确率 ${acc.toFixed(1)}%`)
}
