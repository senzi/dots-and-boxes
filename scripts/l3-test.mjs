import { performance } from 'node:perf_hooks'
import {
  createBoard, placeEdge, legalMoves, immediateGainFast, edgeId,
  isGameOver, scores
} from '../src/engine/board.js'
import { AI_LEVELS, aiMoveLevel3 } from '../src/engine/ai.js'

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

console.log('— 主动弃吃 / 双十字 —')
const cross = createBoard()
for (const [dir, r, c] of [
  ['H', 1, 1], ['H', 2, 1], ['V', 1, 1],
  ['H', 1, 2], ['H', 2, 2]
]) placeEdge(cross, dir, r, c, 0)
check('测试局面存在立即得分边', immediateGainFast(cross, 'V-1-2') === 1)
const crossMove = aiMoveLevel3(cross, 1)
check('L3 可在有格可吃时选择非得分边', immediateGainFast(cross, edgeId(crossMove.dir, crossMove.r, crossMove.c)) === 0)
check('选择隔离两格赠送块的日字边', edgeId(crossMove.dir, crossMove.r, crossMove.c) === 'V-1-3')

console.log('— L3 完整自战与耗时 —')
const game = createBoard()
let player = 0
let steps = 0
let worstMs = 0
let totalMs = 0
let stayedPure = true
while (!isGameOver(game) && steps < 200) {
  const snapshot = JSON.stringify(game)
  const start = performance.now()
  const move = aiMoveLevel3(game, player)
  const elapsed = performance.now() - start
  worstMs = Math.max(worstMs, elapsed)
  totalMs += elapsed
  stayedPure &&= JSON.stringify(game) === snapshot
  const result = placeEdge(game, move.dir, move.r, move.c, player)
  if (!result.gained) player = 1 - player
  steps++
}
const finalScores = scores(game)
check('完整自战所有调用均不修改输入', stayedPure)
check('完整自战结束', isGameOver(game) && steps === 142)
check('63 格全部分配', finalScores[0] + finalScores[1] === 63)
check(`最慢单步 ${worstMs.toFixed(2)}ms < 2000ms`, worstMs < 2000)
console.log(`  自战比分 ${finalScores[0]}:${finalScores[1]}，AI 计算总计 ${totalMs.toFixed(2)}ms，最慢 ${worstMs.toFixed(2)}ms`)

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
