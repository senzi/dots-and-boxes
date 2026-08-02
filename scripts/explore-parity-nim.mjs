// 翻转边博弈模拟：双方轮流"下翻转边"（动态重扫），看 R 奇偶 vs 最终奇偶
// 验证"最后翻转权"假说：R 奇数 → 先手拿最后翻转权 → 定最终奇偶？
// node scripts/explore-parity-nim.mjs [局面数] [已填边数]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ARBoard = require('../ai-research/src/board.js')
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

const count = Number(process.argv[2] || 10)
const target = Number(process.argv[3] || 58)
const seedBase = Number(process.argv[4] || 220000)

function growPartial(seed, tgt) {
  const rng = Frontier.mulberry32(seed)
  let mask = 0n
  let lastMove = null
  while (ARBoard.bitCount(mask) < tgt) {
    const safe = ARBoard.legal(mask).filter(i => ARBoard.danger(mask, i) === 0)
    if (!safe.length) break
    let choices = safe
    if (lastMove != null) {
      const prior = ARBoard.edges[lastMove]
      const endpoints = e => e.dir === 'H' ? [[e.c, e.r], [e.c + 1, e.r]] : [[e.c, e.r], [e.c, e.r + 1]]
      const touches = safe.filter(index => {
        const edge = ARBoard.edges[index]
        return endpoints(edge).some(a => endpoints(prior).some(b => a[0] === b[0] && a[1] === b[1]))
      })
      if (touches.length) choices = touches
    }
    lastMove = choices[Math.floor(rng() * choices.length)]
    mask = ARBoard.put(mask, lastMove)
  }
  return mask
}
function growFull(mask, rngSeed) {
  const rng = Frontier.mulberry32(rngSeed)
  let lastMove = null
  while (true) {
    const safe = ARBoard.legal(mask).filter(i => ARBoard.danger(mask, i) === 0)
    if (!safe.length) return mask
    let choices = safe
    if (lastMove != null) {
      const prior = ARBoard.edges[lastMove]
      const endpoints = e => e.dir === 'H' ? [[e.c, e.r], [e.c + 1, e.r]] : [[e.c, e.r], [e.c, e.r + 1]]
      const touches = safe.filter(index => {
        const edge = ARBoard.edges[index]
        return endpoints(edge).some(a => endpoints(prior).some(b => a[0] === b[0] && a[1] === b[1]))
      })
      if (touches.length) choices = touches
    }
    lastMove = choices[Math.floor(rng() * choices.length)]
    mask = ARBoard.put(mask, lastMove)
  }
}
function v12parity(mask, seedBase2) {
  let odd = 0
  for (let g = 0; g < 3; g++) {
    const f = growFull(mask, seedBase2 * 7919 + g * 104729)
    const pred = Outcome.outcome(f, 1)
    let v12 = 0
    for (const b of pred.blocks) if (b.value === 1 || b.value === 2) v12++
    if (v12 % 2 === 1) odd++
  }
  return odd > 1.5 ? 1 : 0
}

let simCounter = 7000000
// 模拟：主视角先动，双方只下"翻转边"（奇偶改变），直到无翻转边
function simulate(mask, seed) {
  let m = mask
  let cur = 0 // 0=主视角先动
  let flips = 0
  let base = v12parity(m, seed)
  let guard = 0
  while (guard++ < 30) {
    const safe = ARBoard.legal(m).filter(e => ARBoard.danger(m, e) === 0)
    const flipEdges = safe.filter(ei => v12parity(ARBoard.put(m, ei), simCounter++) !== base)
    if (!flipEdges.length) break
    // 当前方下一条翻转边（取第一条）
    m = ARBoard.put(m, flipEdges[0])
    flips++
    base = 1 - base // 奇偶翻转
    cur = 1 - cur
  }
  return { flips, finalBase: base }
}

let total = 0, nimCorrect = 0, flipStat = { rOdd: 0, rEven: 0, lastFirst: 0 }
const samples = []
for (let i = 0; i < count; i++) {
  const mask = growPartial(seedBase + i, target)
  const safe = ARBoard.legal(mask).filter(e => ARBoard.danger(mask, e) === 0)
  if (safe.length < 3) continue
  total++
  const base = v12parity(mask, seedBase + i)
  // 初始翻转边资源 R
  const R = safe.filter(ei => v12parity(ARBoard.put(mask, ei), simCounter++) !== base).length
  const rOdd = R % 2 === 1
  if (rOdd) flipStat.rOdd++; else flipStat.rEven++
  const { flips, finalBase } = simulate(mask, seedBase + i * 31)
  // Nim 假说：R 奇数 → 主视角（先手）拿最后翻转权 → 最终奇偶 = 主视角想要的？
  // 主视角想 finalBase=1（奇数→主控 83.4%）——验证 R 奇偶 vs 最终奇偶
  const nimPred = rOdd ? 1 : 0 // 先手（主视角）拿最后翻转权 → 最后一手翻转 → base 翻奇数次？
  if ((finalBase) === nimPred) nimCorrect++
  if (samples.length < 8) samples.push({ seed: seedBase + i, R, rOdd, flips, finalBase, nimPred })
}
console.log(`=== 翻转边博弈（${count} 局面 · 已填${target}） ===`)
console.log(`R 奇数 ${flipStat.rOdd} · R 偶数 ${flipStat.rEven}`)
console.log(`Nim 假说（R奇→先手定奇偶）命中: ${nimCorrect}/${total}（${(nimCorrect / total * 100).toFixed(1)}%）`)
console.log(`样例:`)
for (const s of samples) console.log(`  seed ${s.seed} R=${s.R}(${s.rOdd ? '奇' : '偶'}) 翻了${s.flips}次 最终奇偶=${s.finalBase} Nim预测=${s.nimPred}`)
