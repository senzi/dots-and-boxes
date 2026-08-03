// 安全边数演化轨迹：每步 S_t（安全边数）→ Δ 分布 → 收敛到 0（吸收）
// 路径数估计：∏ S_t（每步分支 = 安全边数）
// node scripts/measure-safety-trajectory.mjs [生成数] [尺寸:6|8]
import { getBoard } from '../src/engine/l4/l4-board.js'

const size = Number(process.argv[3] || 6)
const board = getBoard(size)
const count = Number(process.argv[2] || 200)
const seedBase = Number(process.argv[4] || 360000)

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
// 安全边数 + 格子自由度分布（0-4 边已填计数）
function safetyStats(mask) {
  const degrees = board.degrees(mask)
  let safe = 0
  const fd = [0, 0, 0, 0, 0]
  for (let i = 0; i < board.edges.length; i++) {
    if (board.has(mask, i)) continue
    if (board.danger(mask, i) === 0) safe++
  }
  for (const d of degrees) fd[d]++
  return { safe, fd }
}

const t0 = Date.now()
const deltas = {}
let totalSteps = 0
let totalGames = 0
const s0s = {}
const firstMoves = {}
for (let g = 0; g < count; g++) {
  const rng = mulberry32(seedBase + g)
  let mask = 0n
  let prevSafe = board.edges.length // 空棋盘全部安全
  let steps = 0
  while (true) {
    const safe = board.legal(mask).filter(i => board.danger(mask, i) === 0)
    if (!safe.length) break
    const S = safe.length
    if (steps === 0) { s0s[S] = (s0s[S] || 0) + 1 }
    if (steps === 1) firstMoves[prevSafe - S] = (firstMoves[prevSafe - S] || 0) + 1
    const pick = safe[Math.floor(rng() * safe.length)]
    mask = board.put(mask, pick)
    const stats = safetyStats(mask)
    const delta = stats.safe - S
    deltas[delta] = (deltas[delta] || 0) + 1
    totalSteps++
    steps++
    prevSafe = S
  }
  totalGames++
}
const dist = obj => Object.entries(obj).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(' ')
console.log(`=== 安全边数演化（${size}×${size} · ${count} 局） ===`)
console.log(`开局安全边 S0 分布: ${dist(s0s)}`)
console.log(`每步 Δ=S'−S 分布: ${dist(deltas)}`)
console.log(`平均每步 Δ: ${(Object.entries(deltas).reduce((s, [k, v]) => s + Number(k) * v, 0) / totalSteps).toFixed(2)}`)
console.log(`平均收敛步数: ${(totalSteps / totalGames).toFixed(1)}（到 0 安全边）`)
// 路径数粗估：∏ S_t ≈ 用平均轨迹（S 从 S0 线性降到 0，每步分支≈当前 S）
const S0 = board.edges.length
const avgSteps = totalSteps / totalGames
const dropPerStep = S0 / avgSteps // 粗略：S0 → 0 线性
let logPath = 0
for (let s = S0; s > 0; s -= dropPerStep) logPath += Math.log10(Math.max(1, s))
console.log(`\n路径数粗估（每步分支≈当前安全边数，线性降模型）:`)
console.log(`  log10(路径) ≈ ${logPath.toFixed(0)} → 路径 ≈ 10^${logPath.toFixed(0)}`)
console.log(`  对照：6×6 前沿下界 ~2e8（log10 ≈ 8.3）`)
