// 分析 losing-sequences.jsonl：找"必输局面"的序列规律
// node scripts/analyze-losing.mjs [数据文件]
import fs from 'node:fs'
import path from 'node:path'

const file = process.argv[2] || path.resolve('ai-research/explore/data/losing-sequences.jsonl')
const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))

const wins = rows.filter(r => r.result === 'win')
const loses = rows.filter(r => r.result === 'lose')
const winFeats = wins.map(features)
const loseFeats = loses.map(features)
console.log(`总数 ${rows.length} · 胜 ${wins.length}（${(wins.length / rows.length * 100).toFixed(1)}%）· 负 ${loses.length}`)

function avg(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0 }

// 每局特征
function features(r) {
  const values = r.valuePlain.split(',').map(Number)
  const ctrl = r.controlPlain.split('').map(Number)
  const n = values.length
  // 主视角(0)控制的块价值占比
  let v0 = 0, v1 = 0
  for (let i = 0; i < n; i++) { if (ctrl[i] === 0) v0 += values[i]; else v1 += values[i] }
  // 控制权段：最长连续对手控制
  let maxRun = 0, curRun = 0
  for (const c of ctrl) { curRun = c === 1 ? curRun + 1 : 0; maxRun = Math.max(maxRun, curRun) }
  // 值分布
  const ones = values.filter(v => v === 1).length
  const twos = values.filter(v => v === 2).length
  const fours = values.filter(v => v === 4).length
  const bigs = values.filter(v => v > 4).length
  // 最后一块归属
  const lastCtrl = ctrl[n - 1]
  // 决策统计（净收 > 0 = 吃，< 0 = 让）
  const netGains = r.valueSeq.map(s => { const m = s.split('/'); return Number(m[2]) })
  const keeps = netGains.filter(g => g < 0).length
  const takes = netGains.filter(g => g > 0).length
  return { v0, v1, v0Ratio: v0 / (v0 + v1), maxRun, ones, twos, fours, bigs, lastCtrl, keeps, takes }
}

console.log(`\n=== 特征对比（胜 vs 负） ===`)
const keys = ['v0Ratio', 'maxRun', 'ones', 'twos', 'fours', 'bigs', 'lastCtrl', 'keeps', 'takes']
console.log('特征 | 胜(avg) | 负(avg)')
for (const k of keys) {
  console.log(`  ${k.padEnd(9)} | ${avg(winFeats.map(f => f[k])).toFixed(2).padStart(7)} | ${avg(loseFeats.map(f => f[k])).toFixed(2).padStart(7)}`)
}

// 核心假设检验：主视角控制价值占比 vs 胜负
console.log(`\n=== 主视角控制价值占比（v0Ratio）分布 ===`)
const buckets = [0, 0.2, 0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.7, 0.8, 1.01]
for (let i = 0; i < buckets.length - 1; i++) {
  const lo = buckets[i], hi = buckets[i + 1]
  const inWin = winFeats.filter(f => f.v0Ratio >= lo && f.v0Ratio < hi).length
  const inLose = loseFeats.filter(f => f.v0Ratio >= lo && f.v0Ratio < hi).length
  const total = inWin + inLose
  if (total > 0) console.log(`  [${lo.toFixed(2)}-${hi.toFixed(2)}) ${String(total).padStart(4)} 局 · 胜率 ${(inWin / total * 100).toFixed(1)}%`)
}

// lastCtrl（最后一块归属）vs 胜负
console.log(`\n=== 最后一块归属 vs 胜负 ===`)
const last0win = winFeats.filter(f => f.lastCtrl === 0).length
const last0lose = loseFeats.filter(f => f.lastCtrl === 0).length
const last1win = winFeats.filter(f => f.lastCtrl === 1).length
const last1lose = loseFeats.filter(f => f.lastCtrl === 1).length
console.log(`  最后一块归主视角: ${last0win}胜/${last0lose}负 → 胜率 ${(last0win / (last0win + last0lose) * 100).toFixed(1)}%`)
console.log(`  最后一块归对手:   ${last1win}胜/${last1lose}负 → 胜率 ${(last1win / (last1win + last1lose) * 100).toFixed(1)}%`)

// 双序列样例：选 3 个必输局展示完整序列
console.log(`\n=== 必输局样例（含完整双序列） ===`)
for (const r of loses.slice(0, 3)) {
  console.log(`seed ${r.seed} 预测 ${r.predScore[0]}:${r.predScore[1]}`)
  console.log(`  价值: ${r.valueSeq.join(' ')}`)
  console.log(`  控制: ${r.controlSeq.join(' ')}`)
}
