// 三档 AI —— Dots and Boxes 63
// Level 1 休闲：随机 + 避坑
// Level 2 策略：局面评分 + 安全边 + 链感知
// Level 3 大师：安全前沿 + 残余分块 + 严格 handout + 有界吃子搜索
import {
  placeEdge, legalMoves, cloneState, edgeId,
  buildTables, EDGE_BOXES, BOX_EDGE_IDS, immediateGainFast, boxFilledCountFast
} from './board.js'

buildTables()

export const AI_LEVELS = [
  { id: 1, name: '休闲', desc: '新手友好，随机落子、避开陷阱' },
  { id: 2, name: '策略', desc: '普通玩家水平，安全边 + 链分析' },
  { id: 3, name: '大师', desc: '安全前沿 + 分块控制 + 吃子链搜索' }
]

// ---------- 工具 ----------

// 统计所有格子填充边数分布（查表版）
function boxStats(state) {
  const filled = [0, 0, 0, 0, 0] // index = 填充边数
  for (const key of Object.keys(state.boxes)) {
    const [r, c] = key.split('-').map(Number)
    if (state.boxes[key] !== null) continue
    filled[boxFilledCountFast(state, r, c)]++
  }
  return filled
}

// 一条边放置后对手能立即吃到的格子数（危险度）—— 查表版
function moveDanger(state, dir, r, c, player) {
  let danger = 0
  const boxes = EDGE_BOXES[edgeId(dir, r, c)]
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i]
    const key = `${b.r}-${b.c}`
    if (state.boxes[key] !== null) continue
    let n = 0
    const es = BOX_EDGE_IDS[key]
    for (let j = 0; j < 4; j++) {
      if (state.edges[es[j]] !== null) n++
    }
    // 本条边放置后 → n+1；若 n+1 === 3，则对手下一步可吃
    if (n + 1 === 3) danger++
  }
  return danger
}

// 若某条边能立即完成格子，返回收益格子数 —— 查表版
function immediateGain(state, dir, r, c) {
  return immediateGainFast(state, edgeId(dir, r, c))
}

// 吃格链模拟：假设轮到某玩家，他只吃能吃的格子，
// 返回 (本回合总吃格数, 结束时局面)
function eatChain(state, player, gained) {
  // 递归吃格：放置所有能完成格子的边
  const st = cloneState(state)
  let total = gained
  let changed = true
  while (changed) {
    changed = false
    for (const m of legalMoves(st)) {
      const g = immediateGain(st, m.dir, m.r, m.c)
      if (g > 0) {
        placeEdge(st, m.dir, m.r, m.c, player)
        total += g
        changed = true
        break // 重新扫描（一条边可能连锁完成多个格子）
      }
    }
  }
  return { total, st }
}

// ---------- Level 1 休闲 ----------
// 1) 有能吃的先吃
// 2) 否则避免落子到制造三边格的位置（不送格）
// 3) 随机
export function aiMoveLevel1(state, player) {
  const moves = legalMoves(state)
  // 立即吃格
  const gains = moves.filter(m => immediateGain(state, m.dir, m.r, m.c) > 0)
  if (gains.length) return gains[Math.floor(Math.random() * gains.length)]
  // 避免送格：不落子到会让格子变 3 边且这些格子会白送
  const safe = moves.filter(m => moveDanger(state, m.dir, m.r, m.c, player) === 0)
  const pool = safe.length ? safe : moves
  return pool[Math.floor(Math.random() * pool.length)]
}

// ---------- Level 2 策略 ----------
// 启发式评分 + 安全边 + 链控制
function evaluate(state, me, opp) {
  const s = boxStats(state)
  // 3 边格是对手的食物：扣分
  // 2 边格是潜在链：轻度加分（自己的潜在食物）
  // 0/1 边格：中性
  let score = 0
  // 已有分数
  const mine = Object.values(state.boxes).filter(v => v === me).length
  const theirs = Object.values(state.boxes).filter(v => v === opp).length
  score += (mine - theirs) * 2
  // 3 边格：对手下一步可能吃到 → 重罚（尤其孤立的三边格）
  score -= s[3] * 6
  // 2 边格：潜在链资源，轻微加分
  score += s[2] * 0.5
  return score
}

export function aiMoveLevel2(state, player) {
  const opp = 1 - player
  const moves = legalMoves(state)
  // 1) 立即吃格（含连锁）
  const gains = moves.filter(m => immediateGain(state, m.dir, m.r, m.c) > 0)
  if (gains.length) {
    // 贪心：吃最多的
    gains.sort((a, b) => immediateGain(state, b.dir, b.r, b.c) - immediateGain(state, a.dir, a.r, a.c))
    return gains[0]
  }
  // 2) 避免送格，且对局面评分
  let best = null
  let bestScore = -Infinity
  for (const m of moves) {
    const danger = moveDanger(state, m.dir, m.r, m.c, player)
    // 模拟自己落子后对手的吃格收益
    const sim = cloneState(state)
    placeEdge(sim, m.dir, m.r, m.c, player)
    const oppGain = eatChain(sim, opp, 0).total
    const sc = evaluate(sim, player, opp) - oppGain * 4 - danger * 3
    if (sc > bestScore) {
      bestScore = sc
      best = m
    }
  }
  return best
}

// ---------- Level 3 大师 ----------
// 设计目标：浏览器同步调用稳定低延迟。安全阶段不展开宽 minimax；进入
// 安全前沿后按残余连通块开最小块；强制吃格阶段用有界递归选择吃子顺序。

function moveKey(move) {
  return edgeId(move.dir, move.r, move.c)
}

// 同一局面稳定一致，但安全边之间保留类似随机开局的分散性。
function stateHash(state) {
  let hash = 2166136261 >>> 0
  for (const [id, owner] of Object.entries(state.edges)) {
    if (owner === null) continue
    for (let i = 0; i < id.length; i++) {
      hash ^= id.charCodeAt(i)
      hash = Math.imul(hash, 16777619) >>> 0
    }
    hash ^= owner + 1
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash >>> 0
}

function stableMoveHash(seed, move) {
  const id = moveKey(move)
  let hash = seed ^ 0x9e3779b9
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  hash ^= hash >>> 16
  return hash >>> 0
}

function unclaimedDegrees(state) {
  const degrees = {}
  for (const key of Object.keys(state.boxes)) {
    if (state.boxes[key] === null) {
      const [r, c] = key.split('-').map(Number)
      degrees[key] = boxFilledCountFast(state, r, c)
    }
  }
  return degrees
}

// 未填内部边连接未完成格子；边界不作为公共节点，避免把所有块错误连在一起。
function residualComponents(state, degrees) {
  const adjacency = {}
  for (const key of Object.keys(degrees)) adjacency[key] = []
  for (const [id, boxes] of Object.entries(EDGE_BOXES)) {
    if (state.edges[id] !== null || boxes.length !== 2) continue
    const a = `${boxes[0].r}-${boxes[0].c}`
    const b = `${boxes[1].r}-${boxes[1].c}`
    if (!(a in degrees) || !(b in degrees)) continue
    adjacency[a].push(b)
    adjacency[b].push(a)
  }
  const sizeByBox = {}
  const idByBox = {}
  const branchesById = {}
  const boxesById = {}
  const unseen = new Set(Object.keys(adjacency))
  let count = 0
  while (unseen.size) {
    count++
    const first = unseen.values().next().value
    const stack = [first]
    const found = []
    unseen.delete(first)
    while (stack.length) {
      const key = stack.pop()
      found.push(key)
      for (const next of adjacency[key]) {
        if (!unseen.has(next)) continue
        unseen.delete(next)
        stack.push(next)
      }
    }
    for (const key of found) sizeByBox[key] = found.length
    for (const key of found) idByBox[key] = count
    branchesById[count] = found.filter(key => degrees[key] < 2).length
    boxesById[count] = found
  }
  return { count, sizeByBox, idByBox, branchesById, boxesById }
}

function componentSizeForMove(move, components) {
  const boxes = EDGE_BOXES[moveKey(move)]
  let size = 999
  for (const box of boxes) {
    const value = components.sizeByBox[`${box.r}-${box.c}`]
    if (value !== undefined && value < size) size = value
  }
  return size
}

function emptyEdgeSignature(state) {
  let signature = ''
  let byte = 0
  let bit = 0
  for (const owner of Object.values(state.edges)) {
    if (owner === null) byte |= 1 << bit
    bit++
    if (bit === 6) {
      signature += String.fromCharCode(48 + byte)
      byte = 0
      bit = 0
    }
  }
  if (bit) signature += String.fromCharCode(48 + byte)
  return signature
}

// 估算若选择继续吃，本轮最多能取得多少格。真正决策前仍会先检查主动弃吃
// 的双十字落点；因此这不是“强制吃完”的规则。
function bestCaptureRun(state, player, budget, memo) {
  if (--budget.left <= 0) return 0
  const key = emptyEdgeSignature(state)
  const cached = memo.get(key)
  if (cached !== undefined) return cached
  const captures = []
  for (const move of legalMoves(state)) {
    const gain = immediateGainFast(state, moveKey(move))
    if (gain > 0) captures.push({ move, gain })
  }
  if (!captures.length) {
    memo.set(key, 0)
    return 0
  }
  let best = 0
  for (const candidate of captures) {
    const sim = cloneState(state)
    placeEdge(sim, candidate.move.dir, candidate.move.r, candidate.move.c, player)
    const value = candidate.gain + bestCaptureRun(sim, player, budget, memo)
    if (value > best) best = value
    if (budget.left <= 0) break
  }
  memo.set(key, best)
  return best
}

function chooseCapture(state, player, captures) {
  const budget = { left: 12000 }
  const memo = new Map()
  const seed = stateHash(state)
  let best = null
  let bestValue = -1
  let bestTie = -1
  for (const move of captures) {
    const gain = immediateGainFast(state, moveKey(move))
    const sim = cloneState(state)
    placeEdge(sim, move.dir, move.r, move.c, player)
    const value = gain + bestCaptureRun(sim, player, budget, memo)
    const tie = stableMoveHash(seed, move)
    if (value > bestValue || (value === bestValue && tie > bestTie)) {
      best = move
      bestValue = value
      bestTie = tie
    }
    if (budget.left <= 0) break
  }
  return best || captures[0]
}

// 严格识别 handout：模拟一条非得分边后，所有当前可吃格必须一起落入一个
// 与其余棋盘隔离、无分叉、大小恰为 2（长链）或 4（环）的赠送块。
function handoutMoves(state, moves, degrees) {
  const activeBoxes = Object.keys(degrees).filter(key => degrees[key] === 3)
  if (!activeBoxes.length) return []
  const result = []
  for (const move of moves) {
    if (immediateGainFast(state, moveKey(move)) > 0) continue
    const sim = cloneState(state)
    placeEdge(sim, move.dir, move.r, move.c, 0)
    const nextDegrees = unclaimedDegrees(sim)
    const nextComponents = residualComponents(sim, nextDegrees)
    const componentIds = new Set(activeBoxes.map(key => nextComponents.idByBox[key]).filter(id => id !== undefined))
    if (componentIds.size !== 1) continue
    const componentId = componentIds.values().next().value
    const giftBoxes = nextComponents.boxesById[componentId]
    if (!(giftBoxes.length === 2 || giftBoxes.length === 4)) continue
    if (nextComponents.branchesById[componentId] !== 0) continue
    // 不能在赠送块之外留下其他立即可吃格，否则对方会连同别的块一起拿走。
    const allThreeSided = Object.keys(nextDegrees).filter(key => nextDegrees[key] === 3)
    if (allThreeSided.some(key => nextComponents.idByBox[key] !== componentId)) continue
    if (giftBoxes.length === Object.keys(nextDegrees).length) continue // 已是最后一块，无需留
    result.push({ move, gift: giftBoxes.length })
  }
  return result
}

function chooseStableRandom(state, moves) {
  const seed = stateHash(state)
  let best = moves[0]
  let bestHash = -1
  for (const move of moves) {
    const hash = stableMoveHash(seed, move)
    if (hash > bestHash) {
      best = move
      bestHash = hash
    }
  }
  return best
}

export function aiMoveLevel3(state, player) {
  const moves = legalMoves(state)
  if (!moves.length) return null

  // 1) 吃格阶段先寻找双十字。大师 AI 允许主动弃吃以保留控制权。
  const captures = moves.filter(move => immediateGainFast(state, moveKey(move)) > 0)
  if (captures.length) {
    const degrees = unclaimedDegrees(state)
    const handouts = handoutMoves(state, moves, degrees)
    if (handouts.length) {
      const smallestGift = Math.min(...handouts.map(item => item.gift))
      return chooseStableRandom(state, handouts.filter(item => item.gift === smallestGift).map(item => item.move))
    }
    return chooseCapture(state, player, captures)
  }

  // 2) 安全阶段：绝不主动制造三边格。等价安全边使用局面哈希确定性分散。
  const safe = moves.filter(move => moveDanger(state, move.dir, move.r, move.c, player) === 0)
  if (safe.length) return chooseStableRandom(state, safe)

  // 3) 安全前沿：打开最小残余区块，且尽量只制造一个三边格。
  const degrees = unclaimedDegrees(state)
  const components = residualComponents(state, degrees)
  const seed = stateHash(state)
  let best = null
  let bestRank = null
  for (const move of moves) {
    const size = componentSizeForMove(move, components)
    const danger = moveDanger(state, move.dir, move.r, move.c, player)
    const rank = [size, danger, stableMoveHash(seed, move)]
    if (
      bestRank === null || rank[0] < bestRank[0] ||
      (rank[0] === bestRank[0] && rank[1] < bestRank[1]) ||
      (rank[0] === bestRank[0] && rank[1] === bestRank[1] && rank[2] > bestRank[2])
    ) {
      best = move
      bestRank = rank
    }
  }
  return best
}

export function getAiMove(level, state, player) {
  if (level === 1) return aiMoveLevel1(state, player)
  if (level === 3) return aiMoveLevel3(state, player)
  return aiMoveLevel2(state, player)
}

export function aiMoveDelay(level) {
  return level === 3 ? 220 : 350
}
