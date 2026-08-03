// 复现：复盘加载 44 步 → 用户下 H-3-0（第45步）→ L5 决策返回什么
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
let lastMove = null, controlOwner = 1, cur = 0
for (let i = 0; i < seq.length; i++) {
  const [p, id] = seq[i]
  const [dir, r, c] = id.split('-')
  const player = p === 'P0' ? 0 : 1
  controlOwner = l3ControlAfterMove(state, { dir, r: Number(r), c: Number(c) }, player, controlOwner)
  const res = placeEdge(state, dir, Number(r), Number(c), player)
  lastMove = { dir, r: Number(r), c: Number(c), player }
  cur = res.gained ? player : 1 - player
}
console.log(`44 步后: 轮到 P${cur} · legalMoves=${legalMoves(state).length}`)

// 用户下第 45 步 H-3-0（P0）
const userMove = { dir: 'H', r: 3, c: 0 }
const res45 = placeEdge(state, 'H', 3, 0, 0)
console.log(`用户下 H-3-0: ok=${res45.ok} gained=${res45.gained} · 轮到 P${res45.gained ? 0 : 1}`)
controlOwner = l3ControlAfterMove(state, userMove, 0, controlOwner)
lastMove = { ...userMove, player: 0 }

// L5 决策
const legal = legalMoves(state)
console.log(`L5 决策前: legalMoves=${legal.length} · H-3-0 在 legal? ${legal.some(m => m.dir === 'H' && m.r === 3 && m.c === 0)}`)
const aiMove = getAiMove(5, state, 1, lastMove, controlOwner)
console.log(`L5 返回:`, aiMove)
if (aiMove) {
  const ok = legal.some(m => m.dir === aiMove.dir && m.r === aiMove.r && m.c === aiMove.c)
  console.log(`合法? ${ok}`)
}
