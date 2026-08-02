// L4 兜底监控：跑 N 局 L4 vs L3 + 各尺寸自战，统计 l3 兜底触发次数
// node scripts/l4-fallback-monitor.mjs [局数]
import { createBoard, placeEdge, isGameOver, scores, setBoardSize } from '../src/engine/board.js'
import { aiMoveLevel3, aiMoveLevel4, l3ControlAfterMove, l4Stats } from '../src/engine/ai.js'

function playGame(l4Seat) {
  const state = createBoard()
  let player = 0
  let lastMove = null
  let controlOwner = 1
  while (!isGameOver(state)) {
    const move = player === l4Seat ? aiMoveLevel4(state, player, lastMove, controlOwner) : aiMoveLevel3(state, player, lastMove, controlOwner)
    controlOwner = l3ControlAfterMove(state, move, player, controlOwner)
    const result = placeEdge(state, move.dir, move.r, move.c, player)
    lastMove = { ...move, player }
    if (!result.gained) player = 1 - player
  }
  return scores(state)
}

function selfplay(level, sizeId) {
  setBoardSize(sizeId)
  const state = createBoard()
  let player = 0
  let lastMove = null
  let controlOwner = 1
  while (!isGameOver(state)) {
    const move = aiMoveLevel4(state, player, lastMove, controlOwner)
    controlOwner = l3ControlAfterMove(state, move, player, controlOwner)
    const result = placeEdge(state, move.dir, move.r, move.c, player)
    lastMove = { ...move, player }
    if (!result.gained) player = 1 - player
  }
  return scores(state)
}

const games = Number(process.argv[2] || 100)
console.log(`跑 ${games} 局 L4 vs L3（8×8）...`)
for (let g = 0; g < games; g++) playGame(g % 2)

console.log('跑 10 局 L4 自战（6×6）...')
for (let g = 0; g < 10; g++) selfplay(4, 's6')
console.log('跑 10 局 L4 自战（10×10）...')
for (let g = 0; g < 10; g++) selfplay(4, 's10')
setBoardSize('s8')

console.log('\n=== L4 兜底统计 ===')
console.log('总触发次数:', l4Stats.fallbackCount)
console.log('  captures 阶段（无计划）:', l4Stats.fallbackCaptures)
console.log('  安全前沿（开边失败）:', l4Stats.fallbackOpening)
