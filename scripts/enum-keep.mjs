// 枚举 seed 从块 startLabel 起所有"保权/翻转"组合（按块）
// 输出每种组合比分，找最优/最差
// node scripts/enum-keep.mjs [seed] [起始块label]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

const seed = Number(process.argv[2] || 1002)
const startLabel = process.argv[3] || 'J'
const mask = Frontier.generate(seed)
const plain = Outcome.outcome(mask, 1)
const labels = plain.blocks.map(b => b.label)
const startIdx = labels.indexOf(startLabel)
// 从 startLabel 起"真正能保权"的块（handoutEdge 非 null；K/M 田字 null 无法保权、O 终局无选择）
const keepable = []
for (let i = startIdx; i < plain.blocks.length; i++) {
  const b = plain.blocks[i]
  if (b.handoutEdge !== null && b.controlCode !== 'GAME_END') keepable.push({ idx: i, label: b.label, value: b.value })
}
const N = keepable.length
console.log(`seed ${seed} · 从块 ${startLabel} 起可保权块 ${keepable.map(k => `${k.label}(${k.value})`).join(' ')} = ${N} bit = ${2 ** N} 种组合`)
console.log(`（K/M 田字 handoutEdge=null 无法保权，O 终局无选择，不计入）`)

const rows = []
for (let combo = 0; combo < 2 ** N; combo++) {
  const forceSet = new Set()
  for (let k = 0; k < N; k++) {
    if (combo & (1 << (N - 1 - k))) forceSet.add(keepable[k].idx) // 高位=靠前的块
  }
  const res = Outcome.outcome(mask, 1, { forceKeep: forceSet })
  const bits = Array.from({ length: N }, (_, k) => (combo & (1 << (N - 1 - k))) ? 1 : 0).join('')
  rows.push({ combo, bits, score: res.score })
}

// 按玩家0得分排序
rows.sort((a, b) => b.score[0] - a.score[0])
console.log(`\n全部 ${rows.length} 种组合（1=保权，0=翻转；位数从左到右 = ${labels.slice(startIdx).join(' ')}）：`)
for (const r of rows) {
  const mark = r.combo === 0 ? ' ←基线(全翻转)' : r.score[0] >= 40 ? ' ★' : ''
  console.log(`  ${r.bits}  ${r.score[0]}:${r.score[1]}${mark}`)
}
const best = rows[0]
const worst = rows[rows.length - 1]
console.log(`\n最优（玩家0=${best.score[0]}）: ${best.bits}`)
console.log(`最差（玩家0=${worst.score[0]}）: ${worst.bits}`)
console.log(`基线（全翻转）: ${plain.score.join(':')}`)
