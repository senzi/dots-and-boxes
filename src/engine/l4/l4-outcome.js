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
function optionSet(block, c) {
  switch (block.controlCode) {
    case 'GAME_END':
      return [{ take: block.value, give: 0, next: c, label: '终局吃光' }]
    case 'KEEP_BY_2':
    case 'KEEP_BY_4':
      // 保权：控制方吃 controlTake，让 handout 给对手，主动权保持
      // 翻转：控制方全吃 value，主动权交给对手
      return [
        { take: block.controlTake, give: block.handout, next: c, label: `保权·让${block.handout}` },
        { take: block.value, give: 0, next: 1 - c, label: '全吃·翻转' }
      ]
    case 'CHALLENGE_2':
      // 争权：控制方吃 2 翻转，或让 2 保权
      return [
        { take: block.value, give: 0, next: 1 - c, label: '吃2·翻转' },
        { take: 0, give: block.value, next: c, label: '让2·保权' }
      ]
    default: // FORCED_FLIP / TAKE_ALL：无选择，吃光翻转
      return [{ take: block.value, give: 0, next: 1 - c, label: '吃光·翻转' }]
  }
}

// 从后向前 DP：控制方 c 在当前块选择最大化自己（c）的总收益
function solve(blocks, firstPlayer) {
  const n = blocks.length
  const memo = new Map()
  function rec(i, c) {
    if (i >= n) return [0, 0, null]
    const key = i + ':' + c
    if (memo.has(key)) return memo.get(key)
    const block = blocks[i]
    let best = null
    for (const opt of optionSet(block, c)) {
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
  return rec(0, firstPlayer)
}

// 终盘收益与胜负：frontier = 安全前沿 mask，firstPlayer = 主动权方（吃块决策者，0/1）
function outcome(board, frontier, firstPlayer, options) {
  const blocks = decompose(board, frontier, options)
  const [cGain, oppGain, tree] = solve(blocks, firstPlayer)
  return {
    blocks,
    firstPlayer,
    score: firstPlayer === 0 ? [cGain, oppGain] : [oppGain, cGain],
    winner: cGain > oppGain ? 0 : oppGain > cGain ? 1 : -1,
    tree
  }
}

export default { decompose, outcome }
