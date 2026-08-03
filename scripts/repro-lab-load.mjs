// 模拟 Lab.vue load() 确切逻辑：每步前检测安全前沿 → break
// 用户粘贴 45 步序列，看停在几步、current、H-3-0 状态
import { createBoard, placeEdge, legalMoves, setBoardSize } from '../src/engine/board.js'
import { getBoard } from '../src/engine/l4/l4-board.js'
import { stateToMask } from '../src/engine/l4/l4-bridge.js'
import { l3ControlAfterMove } from '../src/engine/ai.js'

setBoardSize('s6')
const seq = [
  ['P0','H-0-1'],['P1','V-0-2'],['P0','V-1-3'],['P1','H-1-3'],['P0','H-1-4'],['P1','V-1-5'],
  ['P0','V-2-4'],['P1','V-3-4'],['P0','V-2-5'],['P1','V-3-5'],['P0','V-4-5'],['P1','V-5-5'],
  ['P0','H-6-4'],['P1','H-6-3'],['P0','H-5-3'],['P1','V-4-4'],['P0','V-5-2'],['P1','H-5-1'],
  ['P0','V-4-2'],['P1','V-3-2'],['P0','H-6-2'],['P1','V-2-3'],['P0','H-2-2'],['P1','H-2-1'],
  ['P0','V-2-1'],['P1','V-1-1'],['P0','V-3-1'],['P1','H-4-0'],['P0','V-4-0'],['P1','H-0-3'],
  ['P0','V-5-0'],['P1','H-4-2'],['P0','H-6-0'],['P1','H-6-5'],['P0','V-4-6'],['P1','H-0-4'],
  ['P0','V-3-6'],['P1','H-0-5'],['P0','V-2-6'],['P1','H-1-0'],['P0','V-1-6'],['P1','H-0-2'],
  ['P0','V-0-6'],['P1','V-2-0'],['P0','H-2-0']
]
const board = getBoard(6)
const st = createBoard()
const mv = []
let cur = seq[0][0] === 'P0' ? 0 : 1
let last = null
let ctrl = 1
let frontierAt = -1
for (const [p, id] of seq) {
  const mask = stateToMask(st)
  const safe = board.legal(mask).filter(e => board.danger(mask, e) === 0)
  if (safe.length === 0) { frontierAt = mv.length; break }
  const [dir, r, c] = id.split('-')
  const player = p === 'P0' ? 0 : 1
  const res = placeEdge(st, dir, Number(r), Number(c), player)
  ctrl = l3ControlAfterMove(st, { dir, r: Number(r), c: Number(c) }, player, ctrl)
  mv.push({ player, dir, r: Number(r), c: Number(c) })
  last = { dir, r: Number(r), c: Number(c), player }
  cur = res.gained ? player : 1 - player
}
console.log(`停在 ${mv.length} 步 · 当前轮 P${cur} · 安全边 ${board.legal(stateToMask(st)).filter(e => board.danger(stateToMask(st), e) === 0).length}`)
console.log(`H-3-0 状态:`, st.edges['H-3-0'])
console.log(`H-2-0 状态:`, st.edges['H-2-0'])
console.log(`lastMove:`, last)
console.log(`legalMoves:`, legalMoves(st).length)
console.log(`\nfrontierAt=${frontierAt} —— 若 43，则第 44 步（V-2-0）是开块，用户序列第 45 步（H-2-0）在前沿后`)
