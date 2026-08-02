// 分析 predict-sequences.jsonl：找预测 vs 实际差异的规律
// node scripts/analyze-predict.mjs [数据文件]
import fs from 'node:fs'
import path from 'node:path'

const file = process.argv[2] || path.resolve('ai-research/explore/data/predict-sequences.jsonl')
const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))

const agree = rows.filter(r => r.agree)
const diff = rows.filter(r => !r.agree)
console.log(`总数 ${rows.length} · 一致 ${agree.length}（${(agree.length / rows.length * 100).toFixed(0)}%）· 差异 ${diff.length}`)

function avg(arr) { return arr.reduce((s, v) => s + v, 0) / (arr.length || 1) }

// 特征对比
console.log(`\n=== 特征对比（一致 vs 差异） ===`)
const feats = {
  filled: r => r.filled,
  blocks: r => r.valueSeq.length,
  ones: r => r.valueSeq.filter(v => v === 1).length,
  twos: r => r.valueSeq.filter(v => v === 2).length,
  fours: r => r.valueSeq.filter(v => v === 4).length,
  big: r => r.valueSeq.filter(v => v > 4).length,
  flips: r => r.controlSeq.filter(c => c === 'F' || c === 'T').length,
  keeps: r => r.controlSeq.filter(c => c === '2' || c === '4').length,
  challenges: r => r.controlSeq.filter(c => c === 'C').length,
  predNet: r => r.predScore[0] - r.predScore[1],
  actualNet: r => r.actualScore[0] - r.actualScore[1]
}
console.log('特征 | 一致(avg) | 差异(avg)')
for (const [k, fn] of Object.entries(feats)) {
  console.log(`  ${k.padEnd(10)} | ${avg(agree.map(fn)).toFixed(2).padStart(7)} | ${avg(diff.map(fn)).toFixed(2).padStart(7)}`)
}

// 差异局的净差分布
console.log(`\n=== 差异局明细（预测净胜 - 实际净胜） ===`)
for (const r of diff) {
  console.log(`seed ${r.seed} 已填${r.filled} 块${r.valueSeq.length} 价值[${r.valueSeq}] 换权[${r.controlSeq}]`)
  console.log(`  预测 ${r.predScore[0]}:${r.predScore[1]} (${r.predWin === 0 ? '主胜' : r.predWin === 1 ? '主负' : '平'}) 实际 ${r.actualScore[0]}:${r.actualScore[1]} (${r.actualWin === 0 ? '主胜' : r.actualWin === 1 ? '主负' : '平'}) 净差 ${r.diffNet}`)
  // DP 每块决策
  const dec = r.choices.map(c => `${c.label}${c.value}:${c.choice}${c.take !== null ? `(${c.take}/${c.give})` : ''}`)
  console.log(`  DP 决策: ${dec.join(' ')}`)
}

// 关键问题：差异局的"预测胜但实际负"中，DP 决策里有没有可识别的模式？
console.log(`\n=== 规律候选 ===`)
const flipMismatch = diff.filter(r => r.predWin === 0 && r.actualWin === 1)
console.log(`预测主胜但实际主负: ${flipMismatch.length}/${diff.length}`)
for (const r of flipMismatch.slice(0, 5)) {
  console.log(`  seed ${r.seed} 换权[${r.controlSeq}] 预测${r.predScore} 实际${r.actualScore}`)
}
