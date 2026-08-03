// 验证：6×6 开块后 L5 的保权让块是否失败（handoutMoves 找不到让块边 → 吃光放手）
import { createBoard, placeEdge, setBoardSize } from '../src/engine/board.js'
import { getAiMove, l3ControlAfterMove } from '../src/engine/ai.js'
import { getBoard } from '../src/engine/l4/l4-board.js'
import { stateToMask } from '../src/engine/l4/l4-bridge.js'
import L4Outcome from '../src/engine/l4/l4-outcome.js'

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
}

// 前沿分解 + DP 计划
const board = getBoard(6)
const mask = stateToMask(state)
const pred = L4Outcome.outcome(board, mask, 1)
console.log(`=== 44 步前沿 DP 判决（firstPlayer=1，P1 主动权方） ===`)
console.log(`比分 ${pred.score[0]}:${pred.score[1]}（P0:P1）· ${pred.blocks.length} 块`)
pred.blocks.forEach((b, i) => console.log(`  块${i} 值${b.value} [${b.controlCode}] handout=${b.handoutEdge ?? '无'}`))
let node = pred.tree
console.log(`\nDP 决策序列:`)
pred.blocks.forEach((b, i) => {
  const choice = node ? node.choice : '?'
  console.log(`  块${i}（值${b.value}）→ ${choice}`)
  node = node && node.sub
})

// 用户开块 H-2-0
placeEdge(state, 'H', 2, 0, 0)
controlOwner = l3ControlAfterMove(state, { dir: 'H', r: 2, c: 0 }, 0, controlOwner)
lastMove = { dir: 'H', r: 2, c: 0, player: 0 }
console.log(`\n=== 用户开块 H-2-0 后 ===`)

// L5 决策链（模拟 captures 分支）
import { legalMoves, immediateGainFast } from '../src/engine/board.js'
const moves = legalMoves(state)
const moveKey = m => `${m.dir}-${m.r}-${m.c}`
const captures = moves.filter(m => immediateGainFast(state, moveKey(m)) > 0)
console.log(`captures（可吃格边）: ${captures.length} 条`)
console.log(`  ${captures.slice(0, 12).map(m => `${m.dir}-${m.r}-${m.c}`).join(' ')}`)

// L5 实际决策
const aiMove = getAiMove(5, state, 1, lastMove, controlOwner)
console.log(`\nL5 第一手:`, aiMove ? `${aiMove.dir}-${aiMove.r}-${aiMove.c}` : 'null')
const isCapture = captures.some(m => m.dir === aiMove.dir && m.r === aiMove.r && m.c === aiMove.c)
console.log(`是吃格边? ${isCapture}`)
console.log(`\n结论：若 L5 吃格（不是让块）→ 6×6 接块方没有保权（handoutMoves 没找到让块边）→ 与 DP 保权计划冲突`)
