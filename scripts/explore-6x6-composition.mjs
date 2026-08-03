// 6×6 composition 规律 + 组合空间收缩（套界限后）
// 1) 6×6 前沿 → 分解 → 统计 k/v1/v2/v4/终局块分布
// 2) DP 计数有界 composition（k 范围 + 每块值上限）对比 2^34
// node scripts/explore-6x6-composition.mjs [前沿数]
import { getBoard } from '../src/engine/l4/l4-board.js'
import L4Outcome from '../src/engine/l4/l4-outcome.js'

const board = getBoard(6)
const count = Number(process.argv[2] || 3000)
const seedBase = Number(process.argv[3] || 350000)

function mulberry32(seed) {
  let value = seed >>> 0
  return function () {
    value |= 0
    value = value + 0x6D2B79F5 | 0
    let t = Math.imul(value ^ value >>> 15, 1 | value)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
function growFull(seed) {
  const rng = mulberry32(seed)
  let mask = 0n
  let lastMove = null
  while (true) {
    const safe = board.legal(mask).filter(i => board.danger(mask, i) === 0)
    if (!safe.length) return mask
    let choices = safe
    if (lastMove != null) {
      const prior = board.edges[lastMove]
      const endpoints = e => e.dir === 'H' ? [[e.c, e.r], [e.c + 1, e.r]] : [[e.c, e.r], [e.c, e.r + 1]]
      const touches = safe.filter(index => {
        const edge = board.edges[index]
        return endpoints(edge).some(a => endpoints(prior).some(b => a[0] === b[0] && a[1] === b[1]))
      })
      if (touches.length) choices = touches
    }
    lastMove = choices[Math.floor(rng() * choices.length)]
    mask = board.put(mask, lastMove)
  }
}

const t0 = Date.now()
const stats = { k: {}, v1: {}, v2: {}, v4: {}, lastVal: {} }
let total = 0, maxVal = 0
const valueFreq = {}
for (let i = 0; i < count; i++) {
  const mask = growFull(seedBase + i)
  const blocks = L4Outcome.decompose(board, mask)
  total++
  const k = blocks.length
  stats.k[k] = (stats.k[k] || 0) + 1
  let v1 = 0, v2 = 0, v4 = 0
  for (const b of blocks) {
    valueFreq[b.value] = (valueFreq[b.value] || 0) + 1
    if (b.value > maxVal) maxVal = b.value
    if (b.value === 1) v1++
    if (b.value === 2) v2++
    if (b.value === 4) v4++
  }
  stats.v1[v1] = (stats.v1[v1] || 0) + 1
  stats.v2[v2] = (stats.v2[v2] || 0) + 1
  stats.v4[v4] = (stats.v4[v4] || 0) + 1
  stats.lastVal[blocks[blocks.length - 1].value] = (stats.lastVal[blocks[blocks.length - 1].value] || 0) + 1
}
const dist = obj => Object.entries(obj).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(' ')
console.log(`=== 6×6 composition 规律（${total} 前沿 · ${((Date.now() - t0) / 1000).toFixed(0)}s） ===\n`)
console.log(`块数 k: ${dist(stats.k)}`)
console.log(`值1块: ${dist(stats.v1)}`)
console.log(`值2块: ${dist(stats.v2)}`)
console.log(`值4块: ${dist(stats.v4)}`)
console.log(`终局块值: ${dist(stats.lastVal)}`)
console.log(`块值上限 maxV=${maxVal} · 值频率: ${Object.entries(valueFreq).sort((a,b)=>a[0]-b[0]).map(([k,v])=>`${k}:${v}`).join(' ')}`)

// DP 计数有界 composition（有序，35 分成 k 部分、每部分 ≤ maxV）
const N = 35
const kMin = Math.min(...Object.keys(stats.k).map(Number))
const kMax = Math.max(...Object.keys(stats.k).map(Number))
const dp = Array.from({ length: N + 1 }, () => new Array(kMax + 1).fill(0n))
dp[0][0] = 1n
for (let s = 0; s <= N; s++) {
  for (let k = 0; k < kMax; k++) {
    if (dp[s][k] === 0n) continue
    for (let v = 1; v <= maxVal && s + v <= N; v++) dp[s + v][k + 1] += dp[s][k]
  }
}
const full = 2n ** BigInt(N - 1) // 2^34
let bounded = 0n
for (let k = kMin; k <= kMax; k++) bounded += dp[N][k]
console.log(`\n=== 组合空间收缩 ===`)
console.log(`无约束 composition（35 格）：2^34 = ${full.toString()} ≈ ${Number(full).toExponential(2)}`)
console.log(`套界限（k∈[${kMin},${kMax}]、每块≤${maxVal}）：${bounded.toString()} ≈ ${Number(bounded).toExponential(2)}`)
console.log(`收缩比：${(Number(full) / Number(bounded)).toFixed(0)}×（${(Number(bounded) / Number(full) * 100).toFixed(3)}%）`)
console.log(`对照：6×6 前沿实测下界 ~2e8`)
