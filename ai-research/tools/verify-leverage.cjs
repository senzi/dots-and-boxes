// 验证"安全阶段下子的杠杆"：同一开放局面，不同候选安全边 → 生长到前沿 → 预测胜负
// 若候选边导致的主视角胜率差异大 → 安全阶段的子有杠杆（你的实战经验验证）
// node tools/verify-leverage.cjs [局数] [每候选生长次数]
const Board = require('../src/board.js')
const Frontier = require('../src/frontier.js')
const Outcome = require('../src/outcome.js')

const count = Number(process.argv[2] || 50)
const perCandidate = Number(process.argv[3] || 12)
const seedBase = Number(process.argv[4] || 60000)

// 从空棋盘生长 N 条安全边（开放局面，仍可继续）
function growPartial(seed, target) {
  const rng = Frontier.mulberry32(seed)
  let mask = 0n
  let lastMove = null
  while (Board.bitCount(mask) < target) {
    const safe = Board.legal(mask).filter(i => Board.danger(mask, i) === 0)
    if (!safe.length) break
    let choices = safe
    if (lastMove != null) {
      const prior = Board.edges[lastMove]
      const endpoints = e => e.dir === 'H' ? [[e.c, e.r], [e.c + 1, e.r]] : [[e.c, e.r], [e.c, e.r + 1]]
      const touches = safe.filter(index => {
        const edge = Board.edges[index]
        return endpoints(edge).some(a => endpoints(prior).some(b => a[0] === b[0] && a[1] === b[1]))
      })
      if (touches.length) choices = touches
    }
    lastMove = choices[Math.floor(rng() * choices.length)]
    mask = Board.put(mask, lastMove)
  }
  return mask
}

// 从 mask 生长到极大前沿（随机）
function growFull(mask, seed) {
  const rng = Frontier.mulberry32(seed)
  let lastMove = null
  while (true) {
    const safe = Board.legal(mask).filter(i => Board.danger(mask, i) === 0)
    if (!safe.length) return mask
    let choices = safe
    if (lastMove != null) {
      const prior = Board.edges[lastMove]
      const endpoints = e => e.dir === 'H' ? [[e.c, e.r], [e.c + 1, e.r]] : [[e.c, e.r], [e.c, e.r + 1]]
      const touches = safe.filter(index => {
        const edge = Board.edges[index]
        return endpoints(edge).some(a => endpoints(prior).some(b => a[0] === b[0] && a[1] === b[1]))
      })
      if (touches.length) choices = touches
    }
    lastMove = choices[Math.floor(rng() * choices.length)]
    mask = Board.put(mask, lastMove)
  }
}

let leverageCases = 0
let noLeverage = 0
const spreads = []
for (let i = 0; i < count; i++) {
  const seed = seedBase + i
  const partial = growPartial(seed, 40) // 已填 40 边，安全阶段中段
  // 当前方候选安全边（限制 6 条，均匀采样）
  const safeMoves = Board.legal(partial).filter(e => Board.danger(partial, e) === 0)
  if (safeMoves.length < 3) continue
  const step = Math.floor(safeMoves.length / 6) || 1
  const candidates = safeMoves.filter((_, idx) => idx % step === 0).slice(0, 6)
  // 每条候选 → 生长 perCandidate 次 → 预测胜率
  const winRates = []
  for (const edge of candidates) {
    let mask1 = Board.put(partial, edge)
    let wins = 0
    for (let g = 0; g < perCandidate; g++) {
      const frontier = growFull(mask1, seed * 7919 + g * 104729)
      const pred = Outcome.outcome(frontier, 1)
      if (pred.score[0] > pred.score[1]) wins++
    }
    winRates.push(wins / perCandidate)
  }
  const spread = Math.max(...winRates) - Math.min(...winRates)
  spreads.push(spread)
  if (spread > 0.3) leverageCases++
  else noLeverage++
}
const avgSpread = spreads.reduce((s, v) => s + v, 0) / spreads.length
console.log(`=== 安全阶段杠杆验证（${count} 个开放局面 · 每候选 ${perCandidate} 次生长） ===`)
console.log(`候选边胜率极差：均值 ${(avgSpread * 100).toFixed(1)}%`)
console.log(`杠杆显著（极差>30%）: ${leverageCases} 局 · 不显著: ${noLeverage} 局`)
console.log(`结论：${avgSpread > 0.25 ? '✅ 安全阶段的子有显著杠杆（不同选择→不同胜负）' : '⚠️ 杠杆弱（安全阶段选择影响有限）'}`)
