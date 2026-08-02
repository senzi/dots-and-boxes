// 找"预测能保权（保权·让X）但 L4 实际没让（控制方全吃）"的样本 + 地块坐标
// 对每个前沿：预测 blocks（含 handoutEdge/handout/boxes）vs L4 自战实际归属
// 若某"保权·让X"块的控制方把 handout 格子也吃了 → 没让 → 样本
// node scripts/l4-handout-check.mjs [数量] [起始seed]
import { createRequire } from 'node:module'
import { createBoard, placeEdge, isGameOver, scores, setBoardSize } from '../src/engine/board.js'
import { aiMoveLevel4, l3ControlAfterMove } from '../src/engine/ai.js'

const require = createRequire(import.meta.url)
const ARBoard = require('../ai-research/src/board.js')
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

setBoardSize('s8')
const count = Number(process.argv[2] || 60)
const seedBase = Number(process.argv[3] || 1000)

function maskToState(mask) {
  const state = createBoard()
  for (const e of ARBoard.edges) {
    if ((mask & (1n << BigInt(e.index))) !== 0n) state.edges[e.id] = 0
  }
  return state
}

function selfplay(mask) {
  const state = maskToState(mask)
  let player = 0
  let lastMove = null
  let controlOwner = 1
  let steps = 0
  while (!isGameOver(state) && steps < 300) {
    const move = aiMoveLevel4(state, player, lastMove, controlOwner)
    if (!move) break
    controlOwner = l3ControlAfterMove(state, move, player, controlOwner)
    const result = placeEdge(state, move.dir, move.r, move.c, player)
    lastMove = { ...move, player }
    if (!result.gained) player = 1 - player
    steps++
  }
  return state
}

// ai-research 盒子 index → 主项目格 id（r-c）
function boxId(box) {
  return `${box.r}-${box.c}`
}
function edgeId(e) {
  return `${e.dir}-${e.r}-${e.c}`
}

let samples = 0
for (let i = 0; i < count; i++) {
  const seed = seedBase + i
  const mask = Frontier.generate(seed)
  const pred = Outcome.outcome(mask, 1) // 无规则基线
  // 找"保权·让X"的块（预测说能保权）
  let node = pred.tree
  const keepBlocks = []
  for (let j = 0; j < pred.blocks.length; j++) {
    const b = pred.blocks[j]
    const choice = node ? node.choice : null
    if (choice && choice.includes('保权') && b.handoutEdge !== null) {
      keepBlocks.push({ idx: j, block: b, choice })
    }
    node = node && node.sub
  }
  if (!keepBlocks.length) continue
  // L4 自战 → 实际格子归属
  const state = selfplay(mask)
  // 检查每个保权块：handout 格子是否被控制方吃了
  for (const { idx, block, choice } of keepBlocks) {
    // 该块的控制方（从 tree 推）
    let c = 1
    let n = pred.tree
    for (let j = 0; j < idx; j++) { c = n.next; n = n.sub }
    // handout 格子：block.boxes 中 value - controlTake 个（让给对手的）
    const takeBoxes = block.controlTake
    // 找 handout 格子：该块的 boxes，哪些属于 handout（预测让的）
    // 简化：检查块内是否有格子归控制方（控制方若全吃 = 没让）
    // handout 格 = 块盒子中"对手应该吃的"——从 boxes 前 takeBoxes 个是控制方吃的？
    // 更准确：直接看块所有格子归属——若全部归控制方 → 没让
    const allCtrl = block.boxes.every(box => state.boxes[boxId(box)] === c)
    if (allCtrl) {
      samples++
      const hEdge = edgeId(ARBoard.edges[block.handoutEdge])
      console.log(`seed ${seed} 块${block.label} 值${block.value} ${choice} | handoutEdge=${hEdge} handout=${block.handout}`)
      console.log(`  格子(${block.boxes.length}): ${block.boxes.map(boxId).join(' ')}`)
      console.log(`  该块全部归控制方(玩家${c}) —— L4 实际没让，全吃了`)
      console.log(`  前沿: D63F1.${mask.toString(36)}`)
      console.log('')
      if (samples >= 10) break
    }
  }
  if (samples >= 10) break
}
console.log(`共找到 ${samples} 个样本`)
