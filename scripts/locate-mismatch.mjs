// 定位差异根因：DP 块决策 vs L4 实际每块归属（值 2 块是否实际翻转）
// node scripts/locate-mismatch.mjs <seed...>
import { createRequire } from 'node:module'
import { createBoard, placeEdge, isGameOver, scores, setBoardSize } from '../src/engine/board.js'
import { aiMoveLevel4, l3ControlAfterMove } from '../src/engine/ai.js'

const require = createRequire(import.meta.url)
const ARBoard = require('../ai-research/src/board.js')
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

setBoardSize('s8')
const seeds = process.argv.slice(2).map(Number)
if (!seeds.length) { console.error('用法: node scripts/locate-mismatch.mjs <seed...>'); process.exit(1) }

function maskToState(mask) {
  const state = createBoard()
  for (const e of ARBoard.edges) {
    if ((mask & (1n << BigInt(e.index))) !== 0n) state.edges[e.id] = 0
  }
  return state
}

for (const seed of seeds) {
  const mask = Frontier.generate(seed)
  const pred = Outcome.outcome(mask, 1)
  const [pa, pb] = pred.score

  // L4 自战
  const state = maskToState(mask)
  let player = 0
  let lastMove = null
  let controlOwner = 1
  let steps = 0
  const log = []
  while (!isGameOver(state) && steps < 300) {
    const move = aiMoveLevel4(state, player, lastMove, controlOwner)
    if (!move) break
    const beforeCtrl = controlOwner
    controlOwner = l3ControlAfterMove(state, move, player, controlOwner)
    const result = placeEdge(state, move.dir, move.r, move.c, player)
    log.push({ p: player, m: `${move.dir}-${move.r}-${move.c}`, gained: result.gained, ctrlAfter: controlOwner })
    lastMove = { ...move, player }
    if (!result.gained) player = 1 - player
    steps++
  }
  const [sa, sb] = scores(state)

  console.log(`\n===== seed ${seed} =====`)
  console.log(`前沿码: D63F1.${mask.toString(36)}`)
  console.log(`DP 预测 ${pa}:${pb} · 实际 ${sa}:${sb} · 已填 ${ARBoard.bitCount(mask)} 边 · ${steps} 步`)
  console.log(`价值序列 [${pred.blocks.map(b => b.value).join(',')}]`)
  console.log(`换权序列 [${pred.blocks.map(b => b.controlCode === 'GAME_END' ? 'E' : b.controlCode[0] === 'K' ? b.controlCode.slice(-1) : b.controlCode[0]).join(',')}]`)

  // 每块对照：DP 决策 vs 实际格子归属
  console.log(`\n块对照（DP 决策 | 实际归属: 该块格子最终归谁）:`)
  let node = pred.tree
  const boxOwner = state.boxes // {'r-c': owner}
  for (let i = 0; i < pred.blocks.length; i++) {
    const b = pred.blocks[i]
    const boxes = b.boxes.map(idx => { const bb = ARBoard.boxes[idx]; return `${bb.r}-${bb.c}` })
    const owners = boxes.map(key => (boxOwner[key] === undefined ? '?' : boxOwner[key]))
    const who = owners.every(o => o === 0) ? '全归主视角(0)' : owners.every(o => o === 1) ? '全归对手(1)' : `混合[${owners.join(',')}]`
    const opt = node ? `${node.choice} 吃${node.take}/让${node.give}` : '-'
    console.log(`  块${b.label} 值${b.value} 控制${b.controlCode} | DP: ${opt} | 实际: ${who}`)
    node = node && node.sub
  }
  // 输出整个落子序列（方便 value-lab 对照）
  console.log(`\n落子序列（p=玩家, g=吃格数, c=落子后控制方）:`)
  console.log(log.map(l => `${l.p === 0 ? '主' : '对'}${l.m}(${l.gained})c${l.ctrlAfter}`).join(' '))
}
