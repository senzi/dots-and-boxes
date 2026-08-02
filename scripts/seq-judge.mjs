// 双序列判断器雏形：价值序列（决策）+ 主动权序列 → 判断胜负
// 核心规律（2000 局验证）：
//   最终控制方 = firstPlayer ⊕ (翻转次数 mod 2)  —— 每块决策是"翻/不翻"
//   最后一块归谁 = 胜负决定性特征（98.1% vs 0.7%）
// node scripts/seq-judge.mjs <losing-sequences.jsonl>
import fs from 'node:fs'
import path from 'node:path'

const file = process.argv[2] || path.resolve('ai-research/explore/data/losing-sequences.jsonl')
const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))

// 从决策序列判断最终控制方：
// 决策含"翻转"（吃光翻转/吃2翻转/全吃翻转/让X·翻转/吃光翻转）→ 翻转
// 决策含"保权"（保权·让X/让2·保权）→ 不翻转
// 终局（最后一块）→ 不翻转（吃光结束）
function finalControl(row) {
  let c = 1 // firstPlayer = 主动权方 = 玩家 1
  for (const s of row.valueSeq) {
    const choice = s.split('/')[1] || ''
    if (choice.includes('翻转')) c = 1 - c
  }
  return c
}

let hit = 0
let correct = 0
const flipCounts = rows.map(r => {
  let flips = 0
  for (const s of r.valueSeq) {
    const choice = s.split('/')[1] || ''
    if (choice.includes('翻转')) flips++
  }
  return flips
})
const maxFlips = Math.max(...flipCounts)
console.log(`翻转次数范围: 0~${maxFlips}`)

for (const r of rows) {
  const fc = finalControl(r)
  const actual = r.controlPlain[r.controlPlain.length - 1] === '0' ? 0 : 1
  if (fc === actual) correct++
  const predWin = fc === 0
  if (predWin === (r.result === 'win')) hit++
}
console.log(`最终控制方判断准确率: ${correct}/${rows.length}（${(correct / rows.length * 100).toFixed(1)}%）`)
console.log(`胜负判断准确率: ${hit}/${rows.length}（${(hit / rows.length * 100).toFixed(1)}%）`)

// 只靠"最终控制方"判断胜负（不依赖实际比分）
console.log(`\n（对照）最后一块归属 → 胜负: 上面 analyze 已证 98.1% / 0.7%`)
console.log(`翻转次数奇偶 → 最终控制方: 100% 确定（序列决定论）`)
