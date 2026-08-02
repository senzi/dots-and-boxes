// 探索 2：快速预测算法 CLI —— 安全前沿直接判断胜负与预期比分
// 算法：src/outcome.js（价值块序列 + 换权 DP，不模拟对局，~100ms 级）
// 用法：
//   node tools/fast-predict.cjs <D63F1... 或 mask> [firstPlayer]    单局面
//   node tools/fast-predict.cjs batch <file> [firstPlayer]          批量（每行一个码）
const Board = require('../src/board.js')
const Protocol = require('../src/protocol.js')
const Outcome = require('../src/outcome.js')

function parse(code) {
  return code.startsWith('D63F1.') ? Protocol.parseBase36(code.slice(6)) : BigInt(code)
}

function predict(mask, first) {
  const t0 = Date.now()
  const result = Outcome.outcome(mask, first)
  const ms = Date.now() - t0
  const [a, b] = result.score
  const seqCode = result.blocks.map(x => x.controlCode === 'GAME_END' ? 'E' : x.controlCode[0] === 'K' ? x.controlCode.slice(-1) : x.controlCode[0])
  return { mask, first, a, b, winner: result.winner, blocks: result.blocks, seqCode, ms }
}

const arg = process.argv[2]
if (!arg) { console.error('用法: node tools/fast-predict.cjs <D63F1... 或 mask> [firstPlayer] | batch <file> [firstPlayer]'); process.exit(1) }

if (arg === 'batch') {
  const fs = require('fs')
  const file = process.argv[3]
  const first = Number(process.argv[4] || 0)
  const lines = fs.readFileSync(file, 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
  let w0 = 0
  const errors = []
  for (const line of lines) {
    const r = predict(parse(line), first)
    if (r.winner === first) w0++
    errors.push(Math.abs(r.a - r.b))
    console.log(`${line.slice(0, 40)}...  ${r.a}:${r.b}  胜负=${r.winner === first ? '主视角胜' : r.winner === -1 ? '平' : '对手胜'}  ${r.ms}ms`)
  }
  console.log(`\n批量 ${lines.length} 局面：主视角胜 ${w0}（${(w0 / lines.length * 100).toFixed(1)}%）、平 ${lines.length - w0 - errors.filter((_, i) => lines[i] && predict(parse(lines[i]), first).winner === -1).length}`)
  console.log(`比分差 |a-b| 均值 ${(errors.reduce((s, v) => s + v, 0) / errors.length).toFixed(2)}`)
  return
}

const mask = parse(arg)
const first = Number(process.argv[3] || 0)
const r = predict(mask, first)
const names = first === 0 ? ['主视角(先开)', '对手'] : ['主视角(先开)', '对手']
console.log(`前沿已填 ${Board.bitCount(mask)} 边 · 价值块 ${r.blocks.length} 个 · 快速预测 ${r.ms}ms`)
console.log(`价值序列: ${r.blocks.map(x => x.value).join(',')}`)
console.log(`换权序列: ${r.seqCode.join(',')}`)
console.log(`预期比分: ${names[0]} ${r.a} : ${r.b} ${names[1]}`)
console.log(`判断: ${r.winner === -1 ? '平局' : r.winner === first ? '主视角胜' : '主视角负'}`)
