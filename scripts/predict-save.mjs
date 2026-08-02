// 探索：保存 DP 预测序列（价值/换权/决策）+ L4 实际走向，找规律
// 每个安全前沿输出：DP 预测比分/胜负/序列、实际自战比分/胜负、差异
// 数据存到 ai-research/explore/data/ 下（JSONL）
// node scripts/predict-save.mjs [局数] [输出文件]
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
const games = Number(process.argv[2] || 100)
const outFile = process.argv[3] || path.resolve('ai-research/explore/data/predict-sequences.jsonl')
fs.mkdirSync(path.dirname(outFile), { recursive: true })

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
  const movesLog = []
  while (!isGameOver(state) && steps < 300) {
    const move = aiMoveLevel4(state, player, lastMove, controlOwner)
    if (!move) break
    controlOwner = l3ControlAfterMove(state, move, player, controlOwner)
    const result = placeEdge(state, move.dir, move.r, move.c, player)
    movesLog.push({ p: player, m: `${move.dir}-${move.r}-${move.c}`, gained: result.gained })
    lastMove = { ...move, player }
    if (!result.gained) player = 1 - player
    steps++
  }
  return { score: scores(state), movesLog }
}

const fd = fs.openSync(outFile, 'w')
let agree = 0
for (let g = 0; g < games; g++) {
  const mask = Frontier.generate(2000 + g)
  // DP 预测：主动权方 = 玩家 1（主视角 0 先开块）
  const pred = Outcome.outcome(mask, 1)
  const [pa, pb] = pred.score
  const seq = { value: pred.blocks.map(b => b.value), control: pred.blocks.map(b => b.controlCode === 'GAME_END' ? 'E' : b.controlCode[0] === 'K' ? b.controlCode.slice(-1) : b.controlCode[0]) }
  // 每块 DP 最优决策
  const choices = []
  let node = pred.tree
  for (const b of pred.blocks) {
    choices.push({ label: b.label, value: b.value, choice: node ? node.choice : null, take: node ? node.take : null, give: node ? node.give : null })
    node = node && node.sub
  }
  // 实际自战
  const actual = selfplay(mask)
  const [sa, sb] = actual.score
  const predWin = pa > pb ? 0 : pb > pa ? 1 : -1
  const actualWin = sa > sb ? 0 : sb > sa ? 1 : -1
  if (predWin === actualWin) agree++
  const row = {
    seed: 2000 + g,
    frontier: `D63F1.${mask.toString(36)}`,
    filled: ARBoard.bitCount(mask),
    valueSeq: seq.value,
    controlSeq: seq.control,
    choices,
    predScore: [pa, pb],
    predWin,
    actualScore: [sa, sb],
    actualWin,
    agree: predWin === actualWin,
    diffNet: (pa - pb) - (sa - sb)
  }
  fs.writeSync(fd, JSON.stringify(row) + '\n')
}
fs.closeSync(fd)
console.log(`已保存 ${games} 个前沿数据 → ${outFile}`)
console.log(`胜负一致率: ${agree}/${games}（${(agree / games * 100).toFixed(1)}%）`)
