import { performance } from 'node:perf_hooks'
import {
  createBoard, placeEdge, legalMoves, immediateGainFast, edgeId,
  isGameOver, scores
} from '../src/engine/board.js'
import { AI_LEVELS, aiMoveLevel3, l3ControlAfterMove } from '../src/engine/ai.js'

let pass = 0
let fail = 0
function check(name, condition) {
  if (condition) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}`) }
}

console.log('— L3 接口契约 —')
check('L3 已注册到难度列表', AI_LEVELS.some(level => level.id === 3))

const empty = createBoard()
const before = JSON.stringify(empty)
const first = aiMoveLevel3(empty, 0)
const second = aiMoveLevel3(empty, 0)
check('空棋盘返回合法边', legalMoves(empty).some(move => edgeId(move.dir, move.r, move.c) === edgeId(first.dir, first.r, first.c)))
check('不修改输入状态', JSON.stringify(empty) === before)
check('相同局面确定性', edgeId(first.dir, first.r, first.c) === edgeId(second.dir, second.r, second.c))

console.log('— 前沿前免费吃格 / 前沿后双十字 —')
const freeCapture = createBoard()
for (const [dir, r, c] of [
  ['H', 1, 1], ['H', 2, 1], ['V', 1, 1],
  ['H', 1, 2], ['H', 2, 2]
]) placeEdge(freeCapture, dir, r, c, 0)
check('前沿前局面存在立即得分边和大量安全边', immediateGainFast(freeCapture, 'V-1-2') === 1)
const freeMove = aiMoveLevel3(freeCapture, 1)
check('安全边尚存时先吃免费格', immediateGainFast(freeCapture, edgeId(freeMove.dir, freeMove.r, freeMove.c)) > 0)

// 构造只剩一条两格尾链和另一个未开小块的终盘；不存在安全边。
const cross = createBoard()
for (const key of Object.keys(cross.edges)) cross.edges[key] = 0
for (const key of Object.keys(cross.boxes)) cross.boxes[key] = 0
for (const key of ['1-1', '1-2', '4-4']) cross.boxes[key] = null
for (const key of ['V-1-2', 'V-1-3', 'H-4-4', 'V-4-4']) cross.edges[key] = null
check('前沿后测试局面存在立即得分边', immediateGainFast(cross, 'V-1-2') === 1)
const crossMove = aiMoveLevel3(cross, 1)
check('无安全边时可主动弃吃', immediateGainFast(cross, edgeId(crossMove.dir, crossMove.r, crossMove.c)) === 0)
check('选择隔离两格赠送块的日字边', edgeId(crossMove.dir, crossMove.r, crossMove.c) === 'V-1-3')
check('日字后主动权仍在行动方', l3ControlAfterMove(cross, crossMove, 1, 1) === 1)
const giftMove = aiMoveLevel3(cross, 1, null, 0)
check('无主动权时不做日字、先接礼', immediateGainFast(cross, edgeId(giftMove.dir, giftMove.r, giftMove.c)) > 0)

console.log('— 贴近对方上一手 —')
const attacking = createBoard()
placeEdge(attacking, 'H', 4, 4, 0)
const attackingMove = aiMoveLevel3(attacking, 1, { dir: 'H', r: 4, c: 4, player: 0 })
const endpoints = move => move.dir === 'H'
  ? [`${move.r}-${move.c}`, `${move.r}-${move.c + 1}`]
  : [`${move.r}-${move.c}`, `${move.r + 1}-${move.c}`]
const opponentEndpoints = new Set(['4-4', '4-5'])
check('安全落子共享对方上一手端点', endpoints(attackingMove).some(point => opponentEndpoints.has(point)))

console.log('— 等值价值 1/2 短块 minimax —')
function boardFromEdgeMask(text) {
  const state = createBoard()
  const mask = BigInt(text)
  const ids = Object.keys(state.edges)
  for (let index = 0; index < ids.length; index++) {
    if (mask & (1n << BigInt(index))) state.edges[ids[index]] = 0
  }
  return state
}
const variableFrontiers = [
  ['0x2ad0f84d12ab66b224c6b8782fdc826c82ff', 'H-2-1'],
  ['0x8e6290687af3752d37c4e67bf82146219ec', 'V-4-2']
]
let shortWorstMs = 0
for (const [mask, expected] of variableFrontiers) {
  const frontier = boardFromEdgeMask(mask)
  const snapshot = JSON.stringify(frontier)
  const started = performance.now()
  const move = aiMoveLevel3(frontier, 0)
  shortWorstMs = Math.max(shortWorstMs, performance.now() - started)
  check(`旧分叉前沿稳定选择 ${expected}`, edgeId(move.dir, move.r, move.c) === expected)
  check('短块搜索不修改输入', JSON.stringify(frontier) === snapshot)
}
check(`短块搜索最慢 ${shortWorstMs.toFixed(2)}ms < 10000ms`, shortWorstMs < 10000)

console.log('— L3 完整自战与耗时 —')
const game = createBoard()
let player = 0
let steps = 0
let worstMs = 0
let totalMs = 0
let stayedPure = true
let controlOwner = 1
while (!isGameOver(game) && steps < 200) {
  const snapshot = JSON.stringify(game)
  const start = performance.now()
  const move = aiMoveLevel3(game, player, null, controlOwner)
  const elapsed = performance.now() - start
  worstMs = Math.max(worstMs, elapsed)
  totalMs += elapsed
  stayedPure &&= JSON.stringify(game) === snapshot
  controlOwner = l3ControlAfterMove(game, move, player, controlOwner)
  const result = placeEdge(game, move.dir, move.r, move.c, player)
  if (!result.gained) player = 1 - player
  steps++
}
const finalScores = scores(game)
check('完整自战所有调用均不修改输入', stayedPure)
check('完整自战结束', isGameOver(game) && steps === 142)
check('63 格全部分配', finalScores[0] + finalScores[1] === 63)
check(`最慢单步 ${worstMs.toFixed(2)}ms < 10000ms`, worstMs < 10000)
console.log(`  自战比分 ${finalScores[0]}:${finalScores[1]}，AI 计算总计 ${totalMs.toFixed(2)}ms，最慢 ${worstMs.toFixed(2)}ms`)

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
