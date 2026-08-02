// 6×6 安全前沿总数精确估计（生日悖论法）：生成 N 个随机前沿 → 重复对数 R → 总量 ≈ N²/2R
// node scripts/explore-6x6-frontier.mjs [生成数] [seedBase]
import { getBoard } from '../src/engine/l4/l4-board.js'

const board = getBoard(6)
console.log(`6×6 棋盘: ${board.edges.length} 边 · ${board.boxes.length} 格`)

const count = Number(process.argv[2] || 100000)
const seedBase = Number(process.argv[3] || 300000)

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
// 纯随机安全边生长（快）
function growFull(seed) {
  const rng = mulberry32(seed)
  let mask = 0n
  while (true) {
    const safe = board.legal(mask).filter(i => board.danger(mask, i) === 0)
    if (!safe.length) return { mask, filled: board.bitCount(mask) }
    mask = board.put(mask, safe[Math.floor(rng() * safe.length)])
  }
}

const t0 = Date.now()
const filledCounts = {}
const seen = new Map()
let dupPairs = 0
for (let i = 0; i < count; i++) {
  const { mask, filled } = growFull(seedBase + i)
  filledCounts[filled] = (filledCounts[filled] || 0) + 1
  const key = mask.toString(36)
  const prev = seen.get(key) || 0
  if (prev > 0) dupPairs += prev
  seen.set(key, prev + 1)
}
const R = dupPairs
const N = count
const elapsed = ((Date.now() - t0) / 1000).toFixed(0)
console.log(`生成 ${N} 个随机前沿（${elapsed}s · ${(count / (Date.now() - t0) * 1000).toFixed(0)}/s）:`)
console.log(`已填边分布: ${Object.entries(filledCounts).map(([k, v]) => `${k}边:${v}`).join(' · ')}`)
console.log(`唯一前沿: ${seen.size}/${N} · 重复对数 R=${R}`)
console.log(`\n生日悖论估计（总量 ≈ N²/2R）:`)
if (R > 0) {
  const est = (N * N) / (2 * R)
  const lo = (N * N) / (2 * (R + 1.96 * Math.sqrt(R + 1)))
  const hi = (N * N) / (2 * Math.max(1, R - 1.96 * Math.sqrt(R + 1)))
  console.log(`  估计前沿总量 ≈ ${est.toExponential(2)}`)
  console.log(`  95% 区间 ≈ [${lo.toExponential(2)}, ${hi.toExponential(2)}]`)
} else {
  console.log(`  无重复 → 总量 > N²/2 = ${((N * N) / 2).toExponential(2)}（下界）`)
}
console.log(`\n对比 8×8：前沿 ≥1e20`)
