// 分析"主动让权"是否是必输的元凶：
// 必输局里，最后一块归对手的原因 —— 主动让权 vs 被迫翻转
// 核心问题：如果主动让权的块改为保权，最终控制权是否回到主视角（可能不输）
// node scripts/analyze-active-give.mjs [数据文件]
import fs from 'node:fs'
import path from 'node:path'

const file = process.argv[2] || '/tmp/losing-v2.jsonl'
const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))

const loses = rows.filter(r => r.result === 'lose')
const wins = rows.filter(r => r.result === 'win')

// 统计：必输局 / 必胜局中，主动让权块的数量与价值
function statGive(rows) {
  let withActive = 0
  let totalActiveBlocks = 0
  let totalActiveValue = 0
  let totalValue = 0
  for (const r of rows) {
    let a = 0, av = 0
    for (let i = 0; i < r.flags.length; i++) {
      if (r.flags[i] === 'activeGive') { a++; av += r.valuePlain.split(',')[i] ? Number(r.valuePlain.split(',')[i]) : 0 }
    }
    if (a > 0) withActive++
    totalActiveBlocks += a
    totalActiveValue += av
    totalValue += r.valuePlain.split(',').reduce((s, v) => s + Number(v), 0)
  }
  return { withActive, totalActiveBlocks, totalActiveValue, totalValue, n: rows.length }
}

const loseS = statGive(loses)
const winS = statGive(wins)
console.log(`=== 主动让权统计（flag=activeGive：能保权却选翻转） ===`)
console.log(`必输局: ${loseS.n} 局，含主动让权 ${loseS.withActive} 局（${(loseS.withActive / loseS.n * 100).toFixed(1)}%），块 ${loseS.totalActiveBlocks}，价值 ${loseS.totalActiveValue}/${loseS.totalValue}`)
console.log(`必胜局: ${winS.n} 局，含主动让权 ${winS.withActive} 局（${(winS.withActive / winS.n * 100).toFixed(1)}%），块 ${winS.totalActiveBlocks}，价值 ${winS.totalActiveValue}/${winS.totalValue}`)

// 模拟：把 activeGive 块改为"不翻转"（保权），最终控制权会变吗？
// 翻转奇偶：最终控制方 = 1 ⊕ (翻转次数 mod 2)；activeGive 每块贡献 1 次翻转
console.log(`\n=== 模拟：主动让权块改为保权（去掉这些翻转） ===`)
let flipToWin = 0
let flipCandidates = 0
for (const r of loses) {
  // 当前翻转次数（forced + activeGive）
  let flips = 0
  let activeFlips = 0
  for (let i = 0; i < r.flags.length; i++) {
    if (r.flags[i] === 'forced' || r.flags[i] === 'activeGive') flips++
    if (r.flags[i] === 'activeGive') activeFlips++
  }
  // 最终控制方 = 1 ⊕ (flips mod 2)；1 = 对手控制最后块（必输的直接原因）
  const finalCtrl = (1 + flips) % 2 // 1 翻转奇数次 → 0；偶数次 → 1
  const currentLose = finalCtrl === 1
  if (activeFlips > 0) {
    flipCandidates++
    // 如果去掉 activeGive 的翻转（奇偶翻转）→ 最终控制方可能变 0（主视角）
    const newFlips = flips - activeFlips
    const newFinal = (1 + newFlips) % 2
    if (newFinal === 0) flipToWin++
  }
}
console.log(`必输局中：有主动让权 ${flipCandidates} 局`)
console.log(`其中：去掉主动让权后最终控制权回到主视角（可能不输）${flipToWin} 局（${(flipToWin / Math.max(1, flipCandidates) * 100).toFixed(1)}%）`)

// 样例：主动让权导致必输的局
console.log(`\n=== 样例（主动让权 → 必输，改保权可回控制权） ===`)
let shown = 0
for (const r of loses) {
  let flips = 0, activeFlips = 0, activeIdx = []
  for (let i = 0; i < r.flags.length; i++) {
    if (r.flags[i] === 'forced' || r.flags[i] === 'activeGive') flips++
    if (r.flags[i] === 'activeGive') { activeFlips++; activeIdx.push(i) }
  }
  const finalCtrl = (1 + flips) % 2
  if (finalCtrl === 1 && activeFlips > 0 && (1 + flips - activeFlips) % 2 === 0 && shown < 5) {
    shown++
    console.log(`seed ${r.seed} 预测 ${r.predScore[0]}:${r.predScore[1]}`)
    console.log(`  价值: ${r.valueSeq.join(' ')}`)
    console.log(`  控制: ${r.controlSeq.join(' ')}`)
    console.log(`  权属: ${r.flags.map((f, i) => i === r.flags.length - 1 ? f : f[0]).join('')}  （A=主动让权 F=被迫 K=保权）`)
  }
}
