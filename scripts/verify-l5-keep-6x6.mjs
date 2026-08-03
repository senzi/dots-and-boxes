// 验证修复后：44步 → 用户开 H-2-0 → L5(保权修复) vs L4 完整终局比分
import { createBoard, placeEdge, scores, setBoardSize } from '../src/engine/board.js'
import { getAiMove, l3ControlAfterMove } from '../src/engine/ai.js'

setBoardSize('s6')
const seq = 'H-0-1,V-0-2,V-1-3,H-1-3,H-1-4,V-1-5,V-2-4,V-3-4,V-2-5,V-3-5,V-4-5,V-5-5,H-6-4,H-6-3,H-5-3,V-4-4,V-5-2,H-5-1,V-4-2,V-3-2,H-6-2,V-2-3,H-2-2,H-2-1,V-2-1,V-1-1,V-3-1,H-4-0,V-4-0,H-0-3,V-5-0,H-4-2,H-6-0,H-6-5,V-4-6,H-0-4,V-3-6,H-0-5,V-2-6,H-1-0,V-1-6,H-0-2,V-0-6,V-2-0'.split(',')
const state = createBoard()
let ctrl = 1, last = null
for (let i = 0; i < seq.length; i++) {
  const [dir, r, c] = seq[i].split('-')
  const player = i % 2 === 0 ? 0 : 1
  ctrl = l3ControlAfterMove(state, { dir, r: Number(r), c: Number(c) }, player, ctrl)
  placeEdge(state, dir, Number(r), Number(c), player)
  last = { dir, r: Number(r), c: Number(c), player }
}
// 用户开 H-2-0，之后 L5(P1) 保权 vs L4(P0) 打完
placeEdge(state, 'H', 2, 0, 0)
ctrl = l3ControlAfterMove(state, { dir: 'H', r: 2, c: 0 }, 0, ctrl)
last = { dir: 'H', r: 2, c: 0, player: 0 }
let player = 1 // 轮到 L5
let guard = 0
const l5Moves = []
while (!(legalMovesEmpty(state)) && guard++ < 200) {
  const move = getAiMove(player === 1 ? 5 : 4, state, player, last, ctrl)
  if (!move) break
  if (player === 1) l5Moves.push(move.dir + '-' + move.r + '-' + move.c)
  ctrl = l3ControlAfterMove(state, move, player, ctrl)
  const res = placeEdge(state, move.dir, move.r, move.c, player)
  last = { ...move, player }
  if (!res.gained) player = 1 - player
}
function legalMovesEmpty(s) {
  return Object.values(s.edges).every(e => e !== null)
}
const [a, b] = scores(state)
console.log(`终局比分: ${a}:${b}（P0:L4 vs P1:L5）`)
console.log(`L5 落子数: ${l5Moves.length} 手`)
console.log(`DP 判决对照：P1 应拿 29（44 步前沿 firstPlayer=1）`)
console.log(`修复前：L5 吃光翻转 → 24:11 输（P1 只拿 11）`)
