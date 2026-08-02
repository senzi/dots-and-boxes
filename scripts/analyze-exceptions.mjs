// 深挖 0.7% 例外局：最终控制方（翻转奇偶）预测的胜负 vs 实际不一致
// 例外局序列特征：终局块值、控制占比、让分、连庄等 vs 正常局
// node scripts/analyze-exceptions.mjs [数据文件]
import fs from 'node:fs'
import path from 'node:path'

const file = process.argv[2] || path.resolve('ai-research/explore/data/losing-batch.jsonl')
const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))

// 最终控制方：从 firstPlayer=1 开始，翻转奇数次 → 0（主视角）
function finalCtrl(r) {
  let c = 1
  for (const s of r.valueSeq) {
    const choice = s.split('/')[1] || ''
    if (choice.includes('翻转')) c = 1 - c
  }
  return c
}
// 主视角控制价值占比
function v0Ratio(r) {
  const values = r.valuePlain.split(',').map(Number)
  const ctrl = r.controlPlain.split('').map(Number)
  let v0 = 0, v1 = 0
  for (let i = 0; i < values.length; i++) { if (ctrl[i] === 0) v0 += values[i]; else v1 += values[i] }
  return v0 / (v0 + v1)
}
// 对手最长连庄
function maxRun(r) {
  let mx = 0, cur = 0
  for (const ch of r.controlPlain) { cur = ch === '1' ? cur + 1 : 0; mx = Math.max(mx, cur) }
  return mx
}
// 保权让分总和（净收 < 0 的绝对值）
function giveTotal(r) {
  let g = 0
  for (const s of r.valueSeq) {
    const net = Number(s.split('/')[2])
    if (net < 0) g += -net
  }
  return g
}

const normal = []
const exceptions = []
for (const r of rows) {
  const fc = finalCtrl(r)
  const predWin = fc === 0
  const actualWin = r.result === 'win'
  const feat = {
    terminal: Number(r.valuePlain.split(',').slice(-1)[0]), // 终局块值
    v0: v0Ratio(r),
    run: maxRun(r),
    give: giveTotal(r),
    score: r.predScore,
    seq: r.valueSeq,
    ctrl: r.controlPlain
  }
  if (predWin === actualWin) normal.push(feat)
  else exceptions.push({ ...feat, r })
}

const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0
console.log(`正常局 ${normal.length} · 例外局 ${exceptions.length}（${(exceptions.length / rows.length * 100).toFixed(2)}%）`)
console.log(`\n=== 特征对比（正常 vs 例外） ===`)
console.log(`  终局块值   | ${avg(normal.map(f => f.terminal)).toFixed(1)} | ${avg(exceptions.map(f => f.terminal)).toFixed(1)}`)
console.log(`  控制占比   | ${avg(normal.map(f => f.v0)).toFixed(2)} | ${avg(exceptions.map(f => f.v0)).toFixed(2)}`)
console.log(`  对手连庄   | ${avg(normal.map(f => f.run)).toFixed(2)} | ${avg(exceptions.map(f => f.run)).toFixed(2)}`)
console.log(`  让分总和   | ${avg(normal.map(f => f.give)).toFixed(1)} | ${avg(exceptions.map(f => f.give)).toFixed(1)}`)

// 例外局类型：控制了终局却输（fc=0 但 lose） vs 没控制终局却赢（fc=1 但 win）
const loseCtrl0 = exceptions.filter(e => e.r.controlPlain.slice(-1) === '0')
const winCtrl1 = exceptions.filter(e => e.r.controlPlain.slice(-1) === '1')
console.log(`\n=== 例外局分类 ===`)
console.log(`  控制了终局却输（fc=0 但 lose）: ${loseCtrl0.length}`)
console.log(`  没控制终局却赢（fc=1 但 win）: ${winCtrl1.length}`)
if (loseCtrl0.length) {
  console.log(`  终局块值: ${avg(loseCtrl0.map(f => f.terminal)).toFixed(1)} vs 正常 ${avg(normal.map(f => f.terminal)).toFixed(1)}`)
  console.log(`  让分总和: ${avg(loseCtrl0.map(f => f.give)).toFixed(1)} vs 正常 ${avg(normal.map(f => f.give)).toFixed(1)}`)
}

// 样例：5 个例外局完整序列
console.log(`\n=== 例外局样例 ===`)
for (const e of exceptions.slice(0, 5)) {
  console.log(`seed ${e.r.seed} ${e.r.predScore[0]}:${e.r.predScore[1]}（${e.r.result}）终局块=${e.terminal} 控制占比=${e.v0.toFixed(2)} 让分=${e.give}`)
  console.log(`  价值: ${e.seq.join(' ')}`)
  console.log(`  控制: ${e.ctrl}`)
}
