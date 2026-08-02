// 等效前沿局面探索：有序价值序列（值+控制事件）的唯一率
// 若唯一率高（≈100%）→ 等效类≈前沿数（无收益）
// 若唯一率低 → 等效类少（可穷举判决表）
// node scripts/explore-equiv-class.mjs [前沿数]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

const count = Number(process.argv[2] || 2000)
const seedBase = Number(process.argv[3] || 320000)

const seenSeq = new Map() // 序列键 → 计数
const seenVal = new Map() // 仅值序列 → 计数
const seenMulti = new Map() // 值多集 → 计数
let total = 0
const lenDist = {}
for (let i = 0; i < count; i++) {
  const mask = Frontier.generate(seedBase + i)
  const pred = Outcome.outcome(mask, 1)
  total++
  const seq = pred.blocks.map(b => `${b.value}${b.controlCode.replace('KEEP_BY_', 'K')}`).join(',')
  const valSeq = pred.blocks.map(b => b.value).join(',')
  const valMulti = [...pred.blocks.map(b => b.value)].sort((a, b) => a - b).join(',')
  seenSeq.set(seq, (seenSeq.get(seq) || 0) + 1)
  seenVal.set(valSeq, (seenVal.get(valSeq) || 0) + 1)
  seenMulti.set(valMulti, (seenMulti.get(valMulti) || 0) + 1)
  const n = pred.blocks.length
  lenDist[n] = (lenDist[n] || 0) + 1
}
console.log(`=== 等效类探索（${total} 前沿） ===`)
console.log(`块数分布: ${Object.entries(lenDist).map(([k, v]) => `${k}块:${v}`).join(' · ')}`)
console.log(`完整有序序列(值+事件): 唯一 ${seenSeq.size}/${total}（${(seenSeq.size / total * 100).toFixed(1)}%）`)
console.log(`值有序序列:          唯一 ${seenVal.size}/${total}（${(seenVal.size / total * 100).toFixed(1)}%）`)
console.log(`值多集(排序):         唯一 ${seenMulti.size}/${total}（${(seenMulti.size / total * 100).toFixed(1)}%）`)
// 重复最多的序列
let max = 0, maxKey = ''
for (const [k, v] of seenSeq) if (v > max) { max = v; maxKey = k }
console.log(`\n重复最多的序列: [${maxKey}] ×${max}`)
console.log(`\n解读：唯一率高 → 等效类≈前沿数（无收益）；低 → 等效类少（可穷举判决表）`)
