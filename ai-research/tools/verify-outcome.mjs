// 终盘收益预测回归：固定盘面断言（固化 2026-08-01）
import Protocol from '../src/protocol.js'
import Outcome from '../src/outcome.js'

const cases = [
  {
    name: '调试包2（1s9cwv，先手 32:31 胜）',
    frontier: 'D63F1.1s9cwvrwna300sdjs3y3r0jewcan',
    first: 0,
    score: [32, 31],
    winner: 0
  },
  {
    name: '调试包3（3juxpw，先手 32:31 胜）',
    frontier: 'D63F1.3juxpwvsxcihyqr2bilhlpg87kat',
    first: 0,
    score: [32, 31],
    winner: 0
  }
]

let pass = 0
for (const c of cases) {
  const mask = Protocol.parseBase36(c.frontier.slice(6))
  const res = Outcome.outcome(mask, c.first)
  const ok = res.score[0] === c.score[0] && res.score[1] === c.score[1] && res.winner === c.winner
  if (!ok) {
    console.error(`FAIL ${c.name}: 期望 ${c.score} 胜${c.winner}，实际 ${res.score} 胜${res.winner}`)
    process.exit(1)
  }
  pass++
}
console.log(`verify-outcome: ${pass}/${cases.length} 断言通过（终盘比分 + 胜负）`)
