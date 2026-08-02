// 诊断 L5 前瞻触发：统计安全阶段各步的安全边数分布
// node scripts/diag-l5-trigger.mjs
import { createBoard, placeEdge, isGameOver, setBoardSize } from '../src/engine/board.js'
import { aiMoveLevel5, l3ControlAfterMove } from '../src/engine/ai.js'

setBoardSize('s8')
const state = createBoard()
let player = 0, lastMove = null, controlOwner = 1
const counts = {}
let safeSteps = 0, totalSteps = 0
while (!isGameOver(state)) {
  const t = Date.now()
  const move = aiMoveLevel5(state, player, lastMove, controlOwner)
  const dt = Date.now() - t
  // 统计当前安全边数（用 moveDanger 快速判定）
  const moves = Object.keys(state.edges).filter(id => state.edges[id] === null)
  let safeCount = 0
  for (const id of moves) {
    const [dir, r, c] = id.split('-')
    const m = { dir, r: Number(r), c: Number(c) }
    const gain = 0 // 简化：这里用 ai.js 的判定太重，直接用 danger 近似——跳过，只统计 dt
  }
  totalSteps++
  if (dt > 300) safeSteps++
  const bucket = dt > 1500 ? '前瞻(>1.5s)' : dt > 300 ? '中(0.3-1.5s)' : '快(<0.3s)'
  counts[bucket] = (counts[bucket] || 0) + 1
  controlOwner = l3ControlAfterMove(state, move, player, controlOwner)
  const result = placeEdge(state, move.dir, move.r, move.c, player)
  lastMove = { ...move, player }
  if (!result.gained) player = 1 - player
}
console.log(`总步数 ${totalSteps}`)
console.log(counts)
console.log(`(若'前瞻'步数≈0 → L5 前瞻在实战中几乎不触发 → 需要调触发条件)`)
