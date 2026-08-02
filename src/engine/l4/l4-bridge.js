// L4 桥接层：主项目 state ↔ 价值分析 mask + 决策接口
// 主项目边 ID 与 L4 一致（`${dir}-${r}-${c}`），索引不同 → 经 EDGE_BIT 映射
import L4Board from './l4-board.js'
import L4Value from './l4-value.js'
import L4Outcome from './l4-outcome.js'

// 边 id → mask 位（构建一次）
const EDGE_BIT = {}
for (const e of L4Board.edges) EDGE_BIT[e.id] = 1n << BigInt(e.index)

// 主项目 state → L4 mask
export function stateToMask(state) {
  let mask = 0n
  for (const [id, owner] of Object.entries(state.edges)) {
    if (owner !== null) {
      const bit = EDGE_BIT[id]
      if (bit !== undefined) mask |= bit
    }
  }
  return mask
}

// L4 边索引 → 主项目 move
export function edgeIndexToMove(index) {
  const e = L4Board.edges[index]
  return { dir: e.dir, r: e.r, c: e.c }
}

// 主项目 move → L4 边索引
export function moveToEdgeIndex(move) {
  const edge = L4Board.edgeById.get(`${move.dir}-${move.r}-${move.c}`)
  return edge ? edge.index : -1
}

// L4 价值引擎固定 8×8（142 边）；其他尺寸（6×6/10×10）回退 L3
export function l4Supported(state) {
  return Object.keys(state.edges).length === 142
}

// 安全前沿开边决策：分解当前局面，返回最小价值块（该开什么）
// 附带当前块的标准让块（handout）与控制事件（留不留/保不保权）
export function l4Opening(state) {
  const mask = stateToMask(state)
  const groups = L4Value.enumerateValueBlocks(mask)
  if (!groups.length) return null
  const first = groups[0]
  const chosen = first.openings.slice().sort((a, b) => a.edge - b.edge)[0]
  const anotherBlockRemains = chosen.endMask !== L4Board.FULL_MASK
  const handout = anotherBlockRemains
    ? L4Value.findStandardHandout(chosen.startMask, first.boxes, 30000)
    : { gift: 0 }
  const meaning = anotherBlockRemains
    ? L4Value.controlMeaning(first.value, handout.gift)
    : { code: 'GAME_END' }
  return {
    value: first.value,
    boxes: first.boxes.map(i => L4Board.boxes[i].label),
    openings: first.openings.map(o => edgeIndexToMove(o.edge)),
    handout: handout.gift,
    controlCode: meaning.code
  }
}

// 完整终盘预测（outcome DP）
export function l4Predict(state, firstPlayer) {
  return L4Outcome.outcome(stateToMask(state), firstPlayer)
}

export default { stateToMask, edgeIndexToMove, moveToEdgeIndex, l4Opening, l4Predict }
