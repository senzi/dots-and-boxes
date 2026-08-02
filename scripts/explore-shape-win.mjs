// 探索：安全前沿的 值1块/值2块/田字/值4块 数量 vs 主视角胜率
// 田字 = 块恰好 4 格且组成 2×2 方块（r/c 各 2 种取值）
// node scripts/explore-shape-win.mjs [局数] [起始seed]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ARBoard = require('../ai-research/src/board.js')
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

const count = Number(process.argv[2] || 2000)
const seedBase = Number(process.argv[3] || 170000)

// 田字检测：块盒子是否组成 2×2 方块
function isSquare(blockBoxes) {
  if (blockBoxes.length !== 4) return false
  const rs = new Set(blockBoxes.map(b => b.r))
  const cs = new Set(blockBoxes.map(b => b.c))
  return rs.size === 2 && cs.size === 2
}

const rows = []
for (let i = 0; i < count; i++) {
  const mask = Frontier.generate(seedBase + i)
  const pred = Outcome.outcome(mask, 1)
  const win = pred.score[0] > pred.score[1]
  let v1 = 0, v2 = 0, v4 = 0, squares = 0
  for (const b of pred.blocks) {
    const boxes = b.boxes.map(idx => ARBoard.boxes[idx])
    if (b.value === 1) v1++
    if (b.value === 2) v2++
    if (b.value === 4) v4++
    if (isSquare(boxes)) squares++
  }
  rows.push({ win, v1, v2, v4, squares, value: pred.blocks.map(b => b.value).join(',') })
}

// 分桶胜率
function bucket(rows, key, buckets) {
  const out = buckets.map(b => ({ label: b.label, win: 0, total: 0 }))
  for (const r of rows) {
    const idx = buckets.findIndex(b => r[key] >= b.min && (b.max === Infinity || r[key] <= b.max))
    if (idx < 0) continue
    out[idx].total++
    if (r.win) out[idx].win++
  }
  return out
}
function printBucket(name, rows, key, buckets) {
  console.log(`\n${name} 分布 → 主视角胜率:`)
  const out = bucket(rows, key, buckets)
  for (const b of out) {
    console.log(`  ${b.label.padEnd(14)} | ${String(b.total).padStart(5)} 局 | 胜率 ${b.total ? (b.win / b.total * 100).toFixed(1) : 0}%`)
  }
}

console.log(`=== 安全前沿形状探索（${count} 局） ===`)
printBucket('值1块数', rows, 'v1', [
  { label: 'v1=0', min: 0, max: 0 }, { label: 'v1=1', min: 1, max: 1 },
  { label: 'v1=2', min: 2, max: 2 }, { label: 'v1=3+', min: 3, max: Infinity }
])
printBucket('值2块数', rows, 'v2', [
  { label: 'v2=0-1', min: 0, max: 1 }, { label: 'v2=2', min: 2, max: 2 },
  { label: 'v2=3', min: 3, max: 3 }, { label: 'v2=4+', min: 4, max: Infinity }
])
printBucket('田字数', rows, 'squares', [
  { label: '田=0', min: 0, max: 0 }, { label: '田=1', min: 1, max: 1 },
  { label: '田=2', min: 2, max: 2 }, { label: '田=3+', min: 3, max: Infinity }
])
printBucket('值4块数', rows, 'v4', [
  { label: 'v4=0-2', min: 0, max: 2 }, { label: 'v4=3-4', min: 3, max: 4 },
  { label: 'v4=5-6', min: 5, max: 6 }, { label: 'v4=7+', min: 7, max: Infinity }
])

// 均值对比
const winRows = rows.filter(r => r.win)
const loseRows = rows.filter(r => !r.win)
const avg = arr => arr.reduce((s, v) => s + v, 0) / arr.length
console.log(`\n均值对比（胜 vs 负）:`)
console.log(`  值1块: ${avg(winRows.map(r => r.v1)).toFixed(2)} vs ${avg(loseRows.map(r => r.v1)).toFixed(2)}`)
console.log(`  值2块: ${avg(winRows.map(r => r.v2)).toFixed(2)} vs ${avg(loseRows.map(r => r.v2)).toFixed(2)}`)
console.log(`  田字:  ${avg(winRows.map(r => r.squares)).toFixed(2)} vs ${avg(loseRows.map(r => r.squares)).toFixed(2)}`)
console.log(`  值4块: ${avg(winRows.map(r => r.v4)).toFixed(2)} vs ${avg(loseRows.map(r => r.v4)).toFixed(2)}`)
