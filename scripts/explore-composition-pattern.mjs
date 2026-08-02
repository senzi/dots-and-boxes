// 可达 composition 规律探索：块数/值分布/终局块/孤立格界限
// 目标：找到"可达序列"的几何约束（规律）——收缩组合空间
// node scripts/explore-composition-pattern.mjs [前沿数]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

const count = Number(process.argv[2] || 2000)
const seedBase = Number(process.argv[3] || 340000)

const stats = {
  k: {}, valFreq: {}, v1: {}, v2: {}, v4: {}, lastVal: {}, v12: {}
}
let total = 0
for (let i = 0; i < count; i++) {
  const mask = Frontier.generate(seedBase + i)
  const pred = Outcome.outcome(mask, 1)
  total++
  const blocks = pred.blocks
  const k = blocks.length
  stats.k[k] = (stats.k[k] || 0) + 1
  let v1 = 0, v2 = 0, v4 = 0
  for (const b of blocks) {
    stats.valFreq[b.value] = (stats.valFreq[b.value] || 0) + 1
    if (b.value === 1) v1++
    if (b.value === 2) v2++
    if (b.value === 4) v4++
  }
  stats.v1[v1] = (stats.v1[v1] || 0) + 1
  stats.v2[v2] = (stats.v2[v2] || 0) + 1
  stats.v4[v4] = (stats.v4[v4] || 0) + 1
  stats.lastVal[blocks[blocks.length - 1].value] = (stats.lastVal[blocks[blocks.length - 1].value] || 0) + 1
  stats.v12[v1 + v2] = (stats.v12[v1 + v2] || 0) + 1
}
const pct = n => (n / total * 100).toFixed(1) + '%'
const dist = (obj) => Object.entries(obj).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(' ')
console.log(`=== 可达 composition 规律（${total} 前沿 · 8×8） ===\n`)
console.log(`块数 k 分布: ${dist(stats.k)}`)
console.log(`值频率(每块值出现次数总和): ${dist(stats.valFreq)}`)
console.log(`值1块数分布: ${dist(stats.v1)}`)
console.log(`值2块数分布: ${dist(stats.v2)}`)
console.log(`值4块数分布: ${dist(stats.v4)}`)
console.log(`终局块值分布: ${dist(stats.lastVal)}`)
console.log(`v1+v2 分布: ${dist(stats.v12)}`)
console.log(`\n=== 规律线索 ===`)
console.log(`块数范围: ${Math.min(...Object.keys(stats.k).map(Number))}-${Math.max(...Object.keys(stats.k).map(Number))}`)
console.log(`值1块范围: ${Math.min(...Object.keys(stats.v1).map(Number))}-${Math.max(...Object.keys(stats.v1).map(Number))}`)
console.log(`值2块范围: ${Math.min(...Object.keys(stats.v2).map(Number))}-${Math.max(...Object.keys(stats.v2).map(Number))}`)
