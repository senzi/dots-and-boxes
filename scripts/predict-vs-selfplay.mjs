// 探索 3：快速预测 vs 实际自战对比（8×8）
// 同一安全前沿局面：outcome 快速预测 vs 主项目 L4 双席位实际打完
// 主视角 = 安全前沿第一个开块的人（= 玩家 0 先走）
// 自战结果缓存到 explore/data/selfplay-cache.jsonl（L4 改动后需清缓存）
// node scripts/predict-vs-selfplay.mjs [局数] [起始seed]
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { createBoard, placeEdge, isGameOver, scores, setBoardSize } from '../src/engine/board.js'
import { aiMoveLevel4, l3ControlAfterMove } from '../src/engine/ai.js'

const require = createRequire(import.meta.url)
const ARBoard = require('../ai-research/src/board.js')
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

setBoardSize('s8')
const games = Number(process.argv[2] || 50)
const seedBase = Number(process.argv[3] || 1000)
const CACHE_FILE = path.resolve('ai-research/explore/data/selfplay-cache.jsonl')
fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true })

// 自战结果缓存：frontier 码 → { score }
const cache = new Map()
if (fs.existsSync(CACHE_FILE)) {
  for (const line of fs.readFileSync(CACHE_FILE, 'utf8').split('\n').filter(Boolean)) {
    try { const row = JSON.parse(line); cache.set(row.frontier, row.score) } catch (e) { /* 跳过坏行 */ }
  }
}
console.log(`缓存命中 ${cache.size} 个局面`)

function maskToState(mask) {
  const state = createBoard()
  for (const e of ARBoard.edges) {
    if ((mask & (1n << BigInt(e.index))) !== 0n) state.edges[e.id] = 0
  }
  return state
}

function selfplay(mask) {
  const state = maskToState(mask)
  let player = 0
  let lastMove = null
  let controlOwner = 1
  let steps = 0
  while (!isGameOver(state) && steps < 300) {
    const move = aiMoveLevel4(state, player, lastMove, controlOwner)
    if (!move) break
    controlOwner = l3ControlAfterMove(state, move, player, controlOwner)
    const result = placeEdge(state, move.dir, move.r, move.c, player)
    lastMove = { ...move, player }
    if (!result.gained) player = 1 - player
    steps++
  }
  return scores(state)
}

function selfplayCached(mask) {
  const code = `D63F1.${mask.toString(36)}`
  const hit = cache.get(code)
  if (hit) return hit
  const score = selfplay(mask)
  cache.set(code, score)
  fs.appendFileSync(CACHE_FILE, JSON.stringify({ frontier: code, score, ts: Date.now() }) + '\n')
  return score
}

let agree = 0
const diff = []
const cases = []
for (let g = 0; g < games; g++) {
  const mask = Frontier.generate(seedBase + g)
  // 快速预测：主视角（玩家 0）先开块 = 无主动权方（用户定义：开块瞬间即无主动权），
  // 主动权方（吃块决策者）= 玩家 1 → firstPlayer = 1。score 恒为 [玩家0, 玩家1]。
  const pred = Outcome.outcome(mask, 1)
  const [pa, pb] = pred.score
  // 实际自战（缓存）
  const [sa, sb] = selfplayCached(mask)
  const predWin = pa > pb ? 0 : pb > pa ? 1 : -1
  const actualWin = sa > sb ? 0 : sb > sa ? 1 : -1
  if (predWin === actualWin) agree++
  diff.push(Math.abs((pa - pb) - (sa - sb)))
  cases.push({ g, filled: ARBoard.bitCount(mask), pred: `${pa}:${pb}`, actual: `${sa}:${sb}`, predWin, actualWin })
}

console.log(`=== 快速预测 vs 实际自战（${games} 个安全前沿，主视角=先开块方） ===`)
console.log(`\n胜负一致率: ${agree}/${games}（${(agree / games * 100).toFixed(1)}%）`)
console.log(`比分差（预测净胜 − 实际净胜）: 均值 ${(diff.reduce((s, v) => s + v, 0) / diff.length).toFixed(2)} · 中位 ${diff.sort((a, b) => a - b)[Math.floor(diff.length / 2)]} · 最大 ${Math.max(...diff)}`)
console.log(`\n样例（前 15 局）:`)
console.log('  局 | 已填边 | 预测比分 | 实际比分 | 预测 | 实际')
for (const c of cases.slice(0, 15)) {
  console.log(`  ${String(c.g).padStart(2)} | ${String(c.filled).padStart(3)} | ${c.pred.padStart(6)} | ${c.actual.padStart(6)} | ${c.predWin === 0 ? '主胜' : c.predWin === 1 ? '负' : '平'} | ${c.actualWin === 0 ? '主胜' : c.actualWin === 1 ? '负' : '平'}`)
}
