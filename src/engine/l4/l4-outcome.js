// L4 终盘收益预测（ESM 移植自 ai-research/src/outcome.js，参数化 board）
import L4Value from './l4-value.js'

// 价值块序列（完整分解）
function decompose(board, frontier, options) {
  const state = L4Value.create(board, frontier, options)
  while (!state.complete) L4Value.next(state)
  return state.blocks
}

// 每个块，控制方 c（开块方）的可选策略：
//   take = 控制方吃格数，give = 对手吃格数，next = 下一块控制方
// 保权前提：标准让块边存在（handoutEdge 非 null）。开边直接让（handoutEdge=null）
// 时，实际 l3ControlAfterMove 判定非 handout 边 → 控制权翻转（2026-08-02 实测根因）。
function optionSet(block, c) {
  switch (block.controlCode) {
    case 'GAME_END':
      return [{ take: block.value, give: 0, next: c, label: '终局吃光' }]
    case 'KEEP_BY_2':
    case 'KEEP_BY_4': {
      const keeps = block.handoutEdge !== null
      // 保权：控制方吃 controlTake，让 handout 给对手，主动权保持（仅标准让块）
      // 翻转：控制方全吃 value，主动权交给对手
      return [
        { take: block.controlTake, give: block.handout, next: keeps ? c : 1 - c, label: keeps ? `保权·让${block.handout}` : `让${block.handout}·翻转` },
        { take: block.value, give: 0, next: 1 - c, label: '全吃·翻转' }
      ]
    }
    case 'CHALLENGE_2': {
      const keeps = block.handoutEdge !== null
      // 争权：吃 2 翻转；让 2（仅标准让块才保权，否则实际翻转）
      return [
        { take: block.value, give: 0, next: 1 - c, label: '吃2·翻转' },
        { take: 0, give: block.value, next: keeps ? c : 1 - c, label: keeps ? '让2·保权' : '让2·翻转' }
      ]
    }
    default: // FORCED_FLIP / TAKE_ALL：无选择，吃光翻转
      return [{ take: block.value, give: 0, next: 1 - c, label: '吃光·翻转' }]
  }
}

// 从后向前 DP：控制方 c 在当前块选择最大化自己（c）的总收益
// forceKeep：块索引集合，强制这些块选"保权"选项（探索用）
// 内置规则（2026-08-02 实测）：主动让权块（能保权却选翻转）若其路径前面无保权块
// （被迫翻转占主导），则逐个试算强制保权，玩家 0 收益更高才采用（贪心，只改善不劣化）
function solve(blocks, firstPlayer, outerForce) {
  const n = blocks.length
  let force = outerForce || null
  const memo = new Map()
  function rec(i, c) {
    if (i >= n) return [0, 0, null]
    const key = i + ':' + c
    if (memo.has(key)) return memo.get(key)
    const block = blocks[i]
    let best = null
    const opts = optionSet(block, c)
    // forceKeep：强制保权选项；若该块无保权选项（如 handoutEdge=null 的田字），回退全部选项
    const keepOpts = opts.filter(o => o.label.includes('保权'))
    const usable = force && force.has(i) && keepOpts.length ? keepOpts : opts
    for (const opt of usable) {
      const sub = rec(i + 1, opt.next)
      const cTotal = opt.take + (opt.next === c ? sub[0] : sub[1])
      const oppTotal = opt.give + (opt.next === c ? sub[1] : sub[0])
      if (!best || cTotal > best.cTotal) {
        best = { cTotal, oppTotal, choice: opt.label, take: opt.take, give: opt.give, next: opt.next, sub: sub[2] }
      }
    }
    const result = [best.cTotal, best.oppTotal, best]
    memo.set(key, result)
    return result
  }
  const base = rec(0, firstPlayer)
  if (outerForce) return base
  // 规则：主视角（玩家 0）视角下，"前面无保权"的 activeGive 块逐个试算强制保权，
  // 玩家 0 收益更高才采用（贪心；只改善不劣化）。
  const viewScore = res => res[0] // cTotal = firstPlayer 收益
  let node = base[2]
  let sawKeep = false
  const candidates = []
  for (let i = 0; i < n; i++) {
    const b = blocks[i]
    const choice = node ? node.choice : null
    const isActiveGive = !!choice && choice.includes('翻转') &&
      b.handoutEdge !== null && b.controlCode !== 'FORCED_FLIP' && b.controlCode !== 'TAKE_ALL'
    if (isActiveGive && !sawKeep) candidates.push(i)
    if (choice && choice.includes('保权')) sawKeep = true
    node = node && node.sub
  }
  let final = base
  const forceSet = new Set()
  if (candidates.length) {
    for (const idx of candidates) {
      const test = new Set(forceSet)
      test.add(idx)
      force = test
      memo.clear()
      const res = rec(0, firstPlayer)
      if (viewScore(res) > viewScore(final)) { forceSet.add(idx); final = res }
    }
  }
  return final
}

// 终盘收益与胜负：frontier = 安全前沿 mask，firstPlayer = 主动权方（吃块决策者，0/1）
function outcome(board, frontier, firstPlayer, options) {
  const blocks = decompose(board, frontier, options)
  const [cGain, oppGain, tree] = solve(blocks, firstPlayer, options && options.forceKeep)
  return {
    blocks,
    firstPlayer,
    score: firstPlayer === 0 ? [cGain, oppGain] : [oppGain, cGain],
    winner: cGain > oppGain ? 0 : oppGain > cGain ? 1 : -1,
    tree
  }
}

export default { decompose, outcome }
