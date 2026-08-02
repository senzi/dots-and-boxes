// 排查"该保权却翻转"的位置与代价：
// 1. activeGive 块位置（前/中/后 1/3）→ 翻盘率
// 2. activeGive 翻转后的对手连续控制段（maxRun 代价）→ 翻盘率
// 3. "前面保权后面突然翻转"模式 vs 其他 → 翻盘率
// node scripts/locate-active-give.mjs [局数]
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

const count = Number(process.argv[2] || 500)
const seedBase = Number(process.argv[3] || 10000)

function flagFor(block, choice) {
  if (!choice) return 'forced'
  if (choice.includes('保权')) return 'keep'
  if (block.controlCode === 'FORCED_FLIP' || block.controlCode === 'TAKE_ALL') return 'forced'
  if (block.handoutEdge === null) return 'forced'
  return 'activeGive'
}

// 从 DP tree 提取每块的控制方 + flag
function analyze(mask) {
  const base = Outcome.outcome(mask, 1)
  const n = base.blocks.length
  const ctrl = []
  const flags = []
  let node = base.tree
  let c = 1
  for (let i = 0; i < n; i++) {
    ctrl.push(c)
    flags.push(flagFor(base.blocks[i], node ? node.choice : null))
    if (node) { c = node.next; node = node.sub }
  }
  return { base, n, ctrl, flags }
}

// 对手最长连续控制段（给定控制序列）
function maxRun(ctrl) {
  let mx = 0, cur = 0
  for (const x of ctrl) { cur = x === 1 ? cur + 1 : 0; mx = Math.max(mx, cur) }
  return mx
}

const stats = {
  pos: { first: [0, 0], mid: [0, 0], last: [0, 0] }, // [翻盘数, 总数]
  run: { lt3: [0, 0], ge3: [0, 0] },
  pattern: { keepThenFlip: [0, 0], other: [0, 0] },
  samples: []
}

for (let i = 0; i < count; i++) {
  const seed = seedBase + i
  const mask = Frontier.generate(seed)
  const { base, n, ctrl, flags } = analyze(mask)
  const [b0, b1] = base.score
  if (b0 >= b1) continue // 只要必输局

  const activeIdx = flags.map((f, idx) => [f, idx]).filter(x => x[0] === 'activeGive').map(x => x[1])
  if (!activeIdx.length) continue

  // 强制保权重预测
  const forced = Outcome.outcome(mask, 1, { forceKeep: new Set(activeIdx) })
  const [f0, f1] = forced.score
  const isFlip = f0 > f1

  // 第一个 activeGive 的位置（比例）
  const firstPos = activeIdx[0] / n
  // activeGive 翻转后的对手 maxRun（原始路径：activeGive 使控制权翻转给对手）
  // 计算"每个 activeGive 之后"的对手连续段——简化：全局 maxRun
  const run = maxRun(ctrl)
  // 模式：activeGive 前面是否有保权块（前面保权、后面突然翻转）
  let hasKeepBefore = false
  for (const idx of activeIdx) {
    if (flags.slice(0, idx).includes('keep')) { hasKeepBefore = true; break }
  }

  const cat = firstPos < 0.34 ? 'first' : firstPos < 0.67 ? 'mid' : 'last'
  stats.pos[cat][1]++
  if (isFlip) stats.pos[cat][0]++
  const runCat = run >= 3 ? 'ge3' : 'lt3'
  stats.run[runCat][1]++
  if (isFlip) stats.run[runCat][0]++
  const pat = hasKeepBefore ? 'keepThenFlip' : 'other'
  stats.pattern[pat][1]++
  if (isFlip) stats.pattern[pat][0]++

  if (stats.samples.length < 10) stats.samples.push({ seed, base: `${b0}:${b1}`, forced: `${f0}:${f1}`, flip: isFlip, firstPos: firstPos.toFixed(2), run, keepBefore: hasKeepBefore, activeIdx: activeIdx.join(','), flags: flags.map(f => f[0]).join(''), ctrl: ctrl.join('') })
}

console.log(`=== 主动让权位置/代价 vs 翻盘率 ===`)
console.log('分组 | 翻盘/总数 | 翻盘率')
for (const [k, v] of Object.entries(stats.pos)) {
  console.log(`  位置${k === 'first' ? '前1/3' : k === 'mid' ? '中1/3' : '后1/3'} | ${v[0]}/${v[1]} | ${(v[0] / Math.max(1, v[1]) * 100).toFixed(1)}%`)
}
for (const [k, v] of Object.entries(stats.run)) {
  console.log(`  对手连控${k === 'ge3' ? '≥3' : '<3'}块 | ${v[0]}/${v[1]} | ${(v[0] / Math.max(1, v[1]) * 100).toFixed(1)}%`)
}
for (const [k, v] of Object.entries(stats.pattern)) {
  console.log(`  模式${k === 'keepThenFlip' ? '前面保权→后面翻转' : '其他'} | ${v[0]}/${v[1]} | ${(v[0] / Math.max(1, v[1]) * 100).toFixed(1)}%`)
}

console.log(`\n=== 样例 ===`)
for (const s of stats.samples) {
  console.log(`seed ${s.seed} ${s.base} → ${s.forced} ${s.flip ? '✅翻盘' : ''} 首位${s.firstPos} 连控${s.run} 前保${s.keepBefore} A块[${s.activeIdx}]`)
  console.log(`  权属 ${s.flags}  控制 ${s.ctrl}`)
}
