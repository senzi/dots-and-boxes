// 引擎自测 —— node scripts/self-test.mjs
import {
  createBoard, placeEdge, isGameOver, scores, legalMoves,
  remainingEdges, boxEdges, TOTAL_BOXES
} from '../src/engine/board.js'
import { getAiMove } from '../src/engine/ai.js'

let pass = 0, fail = 0
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}`) }
}

console.log('— 棋盘结构 —')
const b = createBoard()
check(`总边数 142（实际 ${Object.keys(b.edges).length}）`, Object.keys(b.edges).length === 142)
check(`可得分格子 63（实际 ${Object.keys(b.boxes).length}）`, Object.keys(b.boxes).length === 63)
check(`移除角点 H(0,0) 不可用`, !('H-0-0' in b.edges))
check(`移除角点 V(0,0) 不可用`, !('V-0-0' in b.edges))
check(`H(0,1) 可用`, 'H-0-1' in b.edges)
check(`V(1,0) 可用`, 'V-1-0' in b.edges)

console.log('— 落子与得分 —')
const b2 = createBoard()
// 围 (1,1) 格子：H(1,1) 上、H(2,1) 下、V(1,1) 左、V(1,2) 右
const moves = [
  ['H', 1, 1], ['H', 2, 1], ['V', 1, 1], ['V', 1, 2]
]
let cur = 0
for (const [i, [d, r, c]] of moves.entries()) {
  const res = placeEdge(b2, d, r, c, cur)
  check(`第 ${i + 1} 步可落子`, res.ok)
  if (res.gained > 0) {
    check(`第 ${i + 1} 步围成 ${res.gained} 格`, res.gained === 1)
    check(`(1,1) 归属 P${cur}`, b2.boxes['1-1'] === cur)
  }
  if (res.gained === 0) cur = 1 - cur
}
check(`最终得分 [0, 1]（实际 ${JSON.stringify(scores(b2))}）`, scores(b2)[0] === 0 && scores(b2)[1] === 1)

console.log('— 重复落子拒绝 —')
const res = placeEdge(b2, 'H', 1, 1, 0)
check(`重复边被拒`, !res.ok)

console.log('— 不可用边拒绝 —')
const res2 = placeEdge(b2, 'H', 0, 0, 0)
check(`H(0,0) 被拒`, !res2.ok)

console.log('— 完整对局（AI 模拟） —')
for (const level of [1, 2, 3]) {
  const st = createBoard()
  let p = 0, steps = 0
  while (!isGameOver(st) && steps < 500) {
    const m = getAiMove(level, st, p)
    const r = placeEdge(st, m.dir, m.r, m.c, p)
    if (r.gained === 0) p = 1 - p
    steps++
  }
  const [a, bb] = scores(st)
  check(`L${level} 对局结束（${steps} 步，${a}:${bb}，格子 ${a + bb}/63）`, isGameOver(st) && a + bb === 63)
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
