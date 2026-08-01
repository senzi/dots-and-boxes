// 三档 AI —— Dots and Boxes 63
// Level 1 休闲：随机 + 避坑
// Level 2 策略：局面评分 + 安全边 + 链感知
// Level 3 大师：minimax + alpha-beta + 终局精确搜索 + 链评估启发式
import {
  placeEdge, legalMoves, isGameOver, cloneState,
  boxEdges, boxFilledCount, remainingEdges, TOTAL_BOXES, edgeId,
  buildTables, EDGE_BOXES, BOX_EDGE_IDS, immediateGainFast, boxFilledCountFast
} from './board.js'

buildTables()

export const AI_LEVELS = [
  { id: 1, name: '休闲', desc: '新手友好，随机落子、避开陷阱' },
  { id: 2, name: '策略', desc: '普通玩家水平，安全边 + 链分析' }
  // L3 大师已禁用（v1 性能不达标），待算法专家重写后恢复
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

function boxEdgesForEdge(state, dir, r, c) {
  const res = []
  if (dir === 'H') {
    if (r - 1 >= 0) res.push([r - 1, c])
    if (r < 8) res.push([r, c])
  } else {
    if (c - 1 >= 0) res.push([r, c - 1])
    if (c < 8) res.push([r, c])
  }
  return res.filter(([br, bc]) => !(br === 0 && bc === 0) && state.boxes[`${br}-${bc}`] === null)
}

// 若某条边能立即完成格子，返回收益格子数 —— 查表版
function immediateGain(state, dir, r, c) {
  return immediateGainFast(state, edgeId(dir, r, c))
}

// 随机抽样 K 个移动（Fisher-Yates 部分洗牌）
function sampleMoves(moves, k) {
  const arr = moves.slice()
  for (let i = 0; i < k && i < arr.length; i++) {
    const j = i + Math.floor(Math.random() * (arr.length - i))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, k)
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

// ---------- Level 3 大师（已禁用） ----------
// v1 性能不达标：单步搜索可达 7s+，终局吃格链分支爆炸。
// 已实现的探索：minimax + alpha-beta + 节点预算 + 安全边裁剪 + 移动抽样 + 静态查表。
// 待算法专家重写（方向：链/环结构分析、终局数据库、对称性剪枝）。
// 代码保留供参考，UI 与 getAiMove 已不引用。
let nodeBudget = 0
function chainAnalysis(state, player) {
  // 链长估算：当前存在的、由 2 边格组成的连通链（简化：直接统计孤立 2 边格对）
  const stats = boxStats(state)
  return stats
}

function search(state, depth, alpha, beta, player, me, opp, maximizing) {
  if (--nodeBudget <= 0) return evaluate(state, me, opp)
  if (isGameOver(state)) {
    const mine = Object.values(state.boxes).filter(v => v === me).length
    return (mine - (TOTAL_BOXES - mine)) * 100
  }
  // 强制吃格阶段：直接执行
  const moves = legalMoves(state)
  const gains = moves.filter(m => immediateGain(state, m.dir, m.r, m.c) > 0)
  if (gains.length > 0) {
    // 吃格分支：同一玩家继续（深度不减，吃格链必须走完；分支多时抽样）
    let candidates = gains
    if (candidates.length > 10) candidates = sampleMoves(candidates, 10)
    let best = maximizing ? -Infinity : Infinity
    for (const m of candidates) {
      const sim = cloneState(state)
      const g = immediateGain(sim, m.dir, m.r, m.c)
      placeEdge(sim, m.dir, m.r, m.c, player)
      const v = search(sim, depth, alpha, beta, player, me, opp, maximizing) + g
      if (maximizing) {
        best = Math.max(best, v)
        alpha = Math.max(alpha, best)
      } else {
        best = Math.min(best, v)
        beta = Math.min(beta, best)
      }
      if (beta <= alpha) break
    }
    return best
  }
  if (depth <= 0) {
    return evaluate(state, me, opp)
  }
  // 切换玩家
  const next = 1 - player
  const nextMaximizing = next === me
  // 非吃格落子：裁剪候选 —— 优先安全边（不送格），无安全边才用全部；再抽样控制分支
  let candidates = moves.filter(m => moveDanger(state, m.dir, m.r, m.c, me) === 0)
  if (!candidates.length) candidates = moves.slice()
  if (candidates.length > 14) candidates = sampleMoves(candidates, 14)
  // 移动排序优化：危险度升序
  const sorted = candidates.sort((a, b) => moveDanger(state, a.dir, a.r, a.c, me) - moveDanger(state, b.dir, b.r, b.c, me))
  let best = maximizing ? -Infinity : Infinity
  for (const m of sorted) {
    const sim = cloneState(state)
    placeEdge(sim, m.dir, m.r, m.c, next)
    const v = search(sim, depth - 1, alpha, beta, next, me, opp, nextMaximizing)
    if (maximizing) {
      best = Math.max(best, v)
      alpha = Math.max(alpha, best)
    } else {
      best = Math.min(best, v)
      beta = Math.min(beta, best)
    }
    if (beta <= alpha) break
  }
  return best
}

export function aiMoveLevel3(state, player) {
  const opp = 1 - player
  const moves = legalMoves(state)
  const rem = remainingEdges(state)
  // 立即吃格
  const gains = moves.filter(m => immediateGain(state, m.dir, m.r, m.c) > 0)
  if (gains.length) {
    gains.sort((a, b) => immediateGain(state, b.dir, b.r, b.c) - immediateGain(state, a.dir, a.r, a.c))
    return gains[0]
  }
  // 终局：剩余边少 → 精确搜索。深度随剩余边数衰减，避免分支爆炸
  // 非吃格阶段的 alpha-beta 在 depth≥6 时开局分支（~130 可选边）仍然很大
  const depth = rem <= 30 ? 12 : rem <= 60 ? 7 : rem <= 90 ? 5 : 4
  // 候选裁剪：优先安全边 + 抽样
  let candidates = moves.filter(m => moveDanger(state, m.dir, m.r, m.c, player) === 0)
  if (!candidates.length) candidates = moves.slice()
  if (candidates.length > 16) candidates = sampleMoves(candidates, 16)
  nodeBudget = 200000
  let best = null
  let bestScore = -Infinity
  for (const m of candidates) {
    const sim = cloneState(state)
    placeEdge(sim, m.dir, m.r, m.c, player)
    const v = search(sim, depth, -Infinity, Infinity, player, player, opp, true)
    if (v > bestScore) {
      bestScore = v
      best = m
    }
  }
  return best
}

export function getAiMove(level, state, player) {
  if (level === 1) return aiMoveLevel1(state, player)
  // L2 兜底：level>=3 的旧设置一律走策略 AI（L3 已禁用）
  return aiMoveLevel2(state, player)
}

export function aiMoveDelay(level) {
  // L3 已禁用，延迟按 L2 封顶
  return level >= 2 ? 350 : 350
}
