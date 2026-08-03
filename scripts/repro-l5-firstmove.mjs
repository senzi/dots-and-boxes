// 复现：44步前沿 → 用户开块 H-2-0 → L5 第一手决策 + captures 分析
import { createBoard, placeEdge, legalMoves, setBoardSize } from '../src/engine/board.js'
import { getAiMove, l3ControlAfterMove } from '../src/engine/ai.js'

setBoardSize('s6')
const seq = [
  ['P0','H-0-1'],['P1','V-0-2'],['P0','V-1-3'],['P1','H-1-3'],['P0','H-1-4'],['P1','V-1-5'],
  ['P0','V-2-4'],['P1','V-3-4'],['P0','V-2-5'],['P1','V-3-5'],['P0','V-4-5'],['P1','V-5-5'],
  ['P0','H-6-4'],['P1','H-6-3'],['P0','H-5-3'],['P1','V-4-4'],['P0','V-5-2'],['P1','H-5-1'],
  ['P0','V-4-2'],['P1','V-3-2'],['P0','H-6-2'],['P1','V-2-3'],['P0','H-2-2'],['P1','H-2-1'],
  ['P0','V-2-1'],['P1','V-1-1'],['P0','V-3-1'],['P1','H-4-0'],['P0','V-4-0'],['P1','H-0-3'],
  ['P0','V-5-0'],['P1','H-4-2'],['P0','H-6-0'],['P1','H-6-5'],['P0','V-4-6'],['P1','H-0-4'],
  ['P0','V-3-6'],['P1','H-0-5'],['P0','V-2-6'],['P1','H-1-0'],['P0','V-1-6'],['P1','H-0-2'],
  ['P0','V-0-6'],['P1','V-2-0']
]
const state = createBoard()
let lastMove = null, controlOwner = 1
for (let i = 0; i < seq.length; i++) {
  const [p, id] = seq[i]
  const [dir, r, c] = id.split('-')
  const player = p === 'P0' ? 0 : 1
  controlOwner = l3ControlAfterMove(state, { dir, r: Number(r), c: Number(c) }, player, controlOwner)
  const res = placeEdge(state, dir, Number(r), Number(c), player)
  lastMove = { dir, r: Number(r), c: Number(c), player }
  if (!res.gained) { /* 交替 */ }
}
console.log(`44 步后：轮到 P${seq[43][0] === 'P0' ? 0 : 1} 之后（lastMove=${lastMove.dir}-${lastMove.r}-${lastMove.c} by P${lastMove.player}）`)

// 用户开块 H-2-0
const res45 = placeEdge(state, 'H', 2, 0, 0)
console.log(`用户下 H-2-0: ok=${res45.ok} gained=${res45.gained} completed=${JSON.stringify(res45.completed || [])}`)
controlOwner = l3ControlAfterMove(state, { dir: 'H', r: 2, c: 0 }, 0, controlOwner)
lastMove = { dir: 'H', r: 2, c: 0, player: 0 }

// 检查 P1 的立即吃格机会
const legal = legalMoves(state)
const boxOwners = state.boxes
let threeEdges = []
for (const [key, owner] of Object.entries(boxOwners)) {
  if (owner !== null) continue
  const [r, c] = key.split('-').map(Number)
  const edges = [`H-${r}-${c}`, `H-${r}-${c + 1}`, `V-${r}-${c}`, `V-${r + 1}-${c}`]
  const filled = edges.filter(e => state.edges[e] !== null).length
  if (filled === 3) threeEdges.push({ key, edges })
}
console.log(`P1 可立即吃（3边格）:`, threeEdges.map(t => t.key).join(', ') || '无')

// L5 决策
const aiMove = getAiMove(5, state, 1, lastMove, controlOwner)
console.log(`\nL5 第一手:`, aiMove)
if (aiMove) {
  const isCapture = threeEdges.some(t => t.edges.includes(`${aiMove.dir}-${aiMove.r}-${aiMove.c}`))
  console.log(`是否吃 3 边格: ${isCapture}`)
}
// 诊断：captures 数 + H-3-0 是否让块边
import { immediateGainFast } from '../src/engine/board.js'
const moveKey = m => `${m.dir}-${m.r}-${m.c}`
const capMoves = legal.filter(m => immediateGainFast(state, moveKey(m)) > 0)
console.log(`\ncaptures 数量: ${capMoves.length}`)
console.log(`captures 前5:`, capMoves.slice(0, 5).map(m => `${m.dir}-${m.r}-${m.c}`))
console.log(`H-3-0 在 captures? ${capMoves.some(m => m.dir === 'H' && m.r === 3 && m.c === 0)}`)
// 分解该局面看块计划
import { getBoard } from '../src/engine/l4/l4-board.js'
import L4Outcome from '../src/engine/l4/l4-outcome.js'
import { stateToMask } from '../src/engine/l4/l4-bridge.js'
const board = getBoard(6)
const mask = stateToMask(state)
const pred = L4Outcome.outcome(board, mask, 1)
console.log(`\n当前局面分解（firstPlayer=1）: ${pred.blocks.length} 块 · 比分 ${pred.score[0]}:${pred.score[1]}`)
pred.blocks.forEach((b, i) => console.log(`  块${i} 值${b.value} [${b.controlCode}] handout=${b.handoutEdge ?? '无'}`))

