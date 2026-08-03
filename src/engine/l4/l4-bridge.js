// L4 桥接层：主项目 state ↔ 价值分析 mask + 决策接口（任意尺寸）
// 主项目边 ID 与 L4 一致（`${dir}-${r}-${c}`），索引不同 → 按尺寸映射
import { getBoard, gridFromEdgeCount } from './l4-board.js'
import L4Value from './l4-value.js'
import L4Outcome from './l4-outcome.js'

// 按边数取 board 实例（缓存）
function boardForState(state) {
  return getBoard(gridFromEdgeCount(Object.keys(state.edges).length))
}

// 边 id → mask 位（按尺寸缓存）
const EDGE_BITS = new Map() // N → { id → bit }
function edgeBits(board) {
  let map = EDGE_BITS.get(board.N)
  if (!map) {
    map = {}
    for (const e of board.edges) map[e.id] = 1n << BigInt(e.index)
    EDGE_BITS.set(board.N, map)
  }
  return map
}

// 主项目 state → L4 mask
export function stateToMask(state) {
  const board = boardForState(state)
  const bits = edgeBits(board)
  let mask = 0n
  for (const [id, owner] of Object.entries(state.edges)) {
    if (owner !== null) {
      const bit = bits[id]
      if (bit !== undefined) mask |= bit
    }
  }
  return mask
}

// L4 边索引 → 主项目 move
export function edgeIndexToMove(board, index) {
  const e = board.edges[index]
  return { dir: e.dir, r: e.r, c: e.c }
}

// 按当前棋盘尺寸把 ai-research 边索引转主项目 move
export function l4MoveFromEdge(state, edgeIndex) {
  const board = boardForState(state)
  return edgeIndexToMove(board, edgeIndex)
}

// ---------- L5 研究版：安全阶段前瞻（移植 ai-research grow-with-mistakes 思路） ----------

// mulberry32 PRNG（与 ai-research 一致）
function mulberry32(seed) {
  let value = seed >>> 0
  return function () {
    value |= 0
    value = value + 0x6D2B79F5 | 0
    let t = Math.imul(value ^ value >>> 15, 1 | value)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// 生长到极大安全前沿：前 explore 步贴边风格（模拟策略下子），之后终盘随机
// 返回极大前沿 mask
export function l5GrowFull(board, mask, seed, explore = 10) {
  const rng = mulberry32(seed)
  let lastMove = null
  let step = 0
  while (true) {
    const legal = board.legal(mask)
    const safe = legal.filter(i => board.danger(mask, i) === 0)
    if (!safe.length) return mask
    let choices = safe
    if (step < explore && lastMove != null) {
      const prior = board.edges[lastMove]
      const endpoints = e => e.dir === 'H' ? [[e.c, e.r], [e.c + 1, e.r]] : [[e.c, e.r], [e.c, e.r + 1]]
      const touches = safe.filter(index => {
        const edge = board.edges[index]
        return endpoints(edge).some(a => endpoints(prior).some(b => a[0] === b[0] && a[1] === b[1]))
      })
      if (touches.length) choices = touches
    }
    lastMove = choices[Math.floor(rng() * choices.length)]
    mask = board.put(mask, lastMove)
    step++
  }
}

// L5 安全阶段选边（safeChooser）：剩 ≤threshold 条安全边才前瞻；否则返回 null（回退贴边）
// 前瞻：候选边（安全边 50% 向上取整最小 5）→ 填 → 生长到前沿 → 判决器比分 → 选最优
// sims ≥ 2 且 sims × 候选 ≤ budget（预算控制每步耗时）
export function l5SafeChooser(state, safeMoves, player, lastMove, options = {}) {
  const threshold = options.threshold || 30
  const budget = options.budget || 28
  const explore = options.explore || 10
  if (safeMoves.length > threshold) return null
  const board = boardForState(state)
  const baseMask = stateToMask(state)
  const nCand = Math.max(5, Math.ceil(safeMoves.length * 0.5))
  const step = Math.max(1, Math.floor(safeMoves.length / nCand))
  const candidates = safeMoves.filter((_, i) => i % step === 0).slice(0, nCand)
  const nSims = Math.max(2, Math.floor(budget / nCand))
  let best = null
  let bestNet = -Infinity
  let seedBase = 9000000
  for (const move of candidates) {
    const e = board.edgeById.get(`${move.dir}-${move.r}-${move.c}`)
    if (!e) continue
    const mask1 = board.put(baseMask, e.index)
    let net = 0
    for (let g = 0; g < nSims; g++) {
      const f = l5GrowFull(board, mask1, seedBase + g * 7919, explore)
      const pred = L4Outcome.outcome(board, f, 1)
      net += player === 0 ? pred.score[0] - pred.score[1] : pred.score[1] - pred.score[0]
    }
    const avgNet = net / nSims
    if (avgNet > bestNet) { bestNet = avgNet; best = move }
    seedBase += 1000
  }
  return best
}

// L6 长考版安全阶段选边（safeChooser）：全局启发 + 频率控制 + 动态参数
// 频率/参数随剩余安全边 R 动态：
//   R>40 早期：休息2手启发1次（30%）· 候选3×sims1 · 探索3（省算力，淹没区）
//   20<R≤40 中期：休息1手（50%）· 候选5×sims2 · 探索6
//   R≤20 后期：必定启发（100%）· 候选50%↑ × sims3 · 探索10（长考决胜区）
// 休息 = 随机安全边（L4 回退为贴边，这里显式随机）
export function l6SafeChooser(state, safeMoves, player, lastMove, options = {}) {
  const R = safeMoves.length
  let freq, nCand, nSims, explore
  if (R > 40) { freq = 0.3; nCand = 3; nSims = 1; explore = 0 }
  else if (R > 20) { freq = 0.5; nCand = 5; nSims = 2; explore = 0 }
  else { freq = 1.0; nCand = Math.max(5, Math.ceil(R * 0.5)); nSims = 3; explore = 0 }
  if (Math.random() > freq) {
    return safeMoves[Math.floor(Math.random() * safeMoves.length)] // 休息：随机安全边
  }
  const board = boardForState(state)
  const baseMask = stateToMask(state)
  const step = Math.max(1, Math.floor(safeMoves.length / nCand))
  const candidates = safeMoves.filter((_, i) => i % step === 0).slice(0, nCand)
  let best = null
  let bestNet = -Infinity
  let seedBase = 12000000
  for (const move of candidates) {
    const e = board.edgeById.get(`${move.dir}-${move.r}-${move.c}`)
    if (!e) continue
    const mask1 = board.put(baseMask, e.index)
    let net = 0
    for (let g = 0; g < nSims; g++) {
      const f = l5GrowFull(board, mask1, seedBase + g * 7919, explore)
      const pred = L4Outcome.outcome(board, f, 1)
      net += player === 0 ? pred.score[0] - pred.score[1] : pred.score[1] - pred.score[0]
    }
    const avgNet = net / nSims
    if (avgNet > bestNet) { bestNet = avgNet; best = move }
    seedBase += 1000
  }
  return best
}

// 安全前沿开边决策：分解当前局面，返回最小价值块（该开什么）
// 附带当前块的标准让块（handout）与控制事件（留不留/保不保权）
export function l4Opening(state) {
  const board = boardForState(state)
  const mask = stateToMask(state)
  const groups = L4Value.enumerateValueBlocks(board, mask)
  if (!groups.length) return null
  const first = groups[0]
  const chosen = first.openings.slice().sort((a, b) => a.edge - b.edge)[0]
  const anotherBlockRemains = chosen.endMask !== board.FULL_MASK
  const handout = anotherBlockRemains
    ? L4Value.findStandardHandout(board, chosen.startMask, first.boxes, 30000)
    : { gift: 0 }
  const meaning = anotherBlockRemains
    ? L4Value.controlMeaning(first.value, handout.gift)
    : { code: 'GAME_END' }
  return {
    value: first.value,
    boxes: first.boxes.map(i => board.boxes[i].label),
    openings: first.openings.map(o => edgeIndexToMove(board, o.edge)),
    handout: handout.gift,
    controlCode: meaning.code
  }
}

// 完整终盘预测（outcome DP）；options.forceKeepAll=true 强制所有块保权（实验）
export function l4Predict(state, firstPlayer, options) {
  const board = boardForState(state)
  const mask = stateToMask(state)
  const opts = {}
  if (options && options.forceKeepAll) {
    const groups = L4Value.enumerateValueBlocks(board, mask)
    opts.forceKeep = new Set(groups.map((_, i) => i))
  }
  return L4Outcome.outcome(board, mask, firstPlayer, opts)
}
export default { stateToMask, edgeIndexToMove, l4MoveFromEdge, l4Opening, l4Predict, l5GrowFull, l5SafeChooser, l6SafeChooser }
