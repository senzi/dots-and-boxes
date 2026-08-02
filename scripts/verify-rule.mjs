// 验证内置规则效果：同 seed 对比旧版（无规则）预测
// 旧版基线：losing-v2.jsonl（seed 10000+，无规则）
// 新版：outcome 内置"前面无保权禁止主动让权"规则
// node scripts/verify-rule.mjs [数量]
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

const count = Number(process.argv[2] || 1000)
const seedBase = Number(process.argv[3] || 10000)
const oldFile = process.argv[4] || path.resolve('ai-research/explore/data/losing-v2.jsonl')

// 旧版数据（seed → predScore）
const oldMap = new Map()
if (fs.existsSync(oldFile)) {
  for (const line of fs.readFileSync(oldFile, 'utf8').split('\n').filter(Boolean)) {
    try { const r = JSON.parse(line); oldMap.set(r.seed, r.predScore) } catch (e) {}
  }
}
console.log(`旧版基线 ${oldMap.size} 局`)

let compared = 0
let improved = 0
let flipped = 0
let unchanged = 0
let worse = 0
let loseOld = 0
let loseNew = 0
const samples = []
for (let i = 0; i < count; i++) {
  const seed = seedBase + i
  const old = oldMap.get(seed)
  if (!old) continue
  const mask = Frontier.generate(seed)
  const r = Outcome.outcome(mask, 1)
  const [n0, n1] = r.score
  const [o0, o1] = old
  if (o0 < o1) loseOld++
  if (n0 < n1) loseNew++
  const oldNet = o0 - o1
  const newNet = n0 - n1
  if (newNet > oldNet) improved++
  else if (newNet < oldNet) worse++
  else unchanged++
  if (n0 > o0) flipped++
  compared++
  if (samples.length < 6) samples.push({ seed, old: `${o0}:${o1}`, now: `${n0}:${n1}`, better: newNet > oldNet })
}

console.log(`=== 内置规则 vs 旧版（${compared} 局对比） ===`)
console.log(`必输局: 旧版 ${loseOld} → 新版 ${loseNew}（少输 ${loseOld - loseNew} 局）`)
console.log(`比分改善: ${improved} · 不变: ${unchanged} · 变差: ${worse}`)
console.log(`主视角得分提高: ${flipped} 局`)
console.log(`\n样例:`)
for (const s of samples) {
  console.log(`  seed ${s.seed} 旧版 ${s.old} → 新版 ${s.now} ${s.better ? '✅改善' : ''}`)
}
