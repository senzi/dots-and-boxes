// 批量收集"主视角必输"局面 + 双序列（价值序列 / 主动权序列）
// 序列1（价值）：每块 值/决策/净收（净收 = 控制方吃 take − 让 give）
// 序列2（主动权）：每块控制方（0=主视角 1=对手）
// 全部局面（含必输/非必输）存 JSONL，供规律分析
// node scripts/collect-losing.mjs [数量] [起始seed] [输出文件]
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const ARBoard = require('../ai-research/src/board.js')
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

const count = Number(process.argv[2] || 2000)
const seedBase = Number(process.argv[3] || 10000)
const outFile = process.argv[4] || path.resolve('ai-research/explore/data/losing-sequences.jsonl')
fs.mkdirSync(path.dirname(outFile), { recursive: true })

function decisionLabel(choice) {
  return choice ? choice.replace(/·/g, '') : '?'
}

const fd = fs.openSync(outFile, 'w')
let loseCount = 0
let winCount = 0
let drawCount = 0
for (let i = 0; i < count; i++) {
  const seed = seedBase + i
  const mask = Frontier.generate(seed)
  // 主视角 = 玩家 0 先开块（无主动权）→ 主动权方 = 玩家 1 → firstPlayer = 1
  const pred = Outcome.outcome(mask, 1)
  const [p0, p1] = pred.score
  const result = p0 > p1 ? 'win' : p0 < p1 ? 'lose' : 'draw'
  if (result === 'lose') loseCount++
  else if (result === 'win') winCount++
  else drawCount++

  // 双序列
  const valueSeq = [] // 值/决策/净收
  const controlSeq = [] // 每块控制方
  let node = pred.tree
  for (const b of pred.blocks) {
    const c = node ? (node.next === undefined ? null : null) : null
    valueSeq.push(`${b.value}/${decisionLabel(node ? node.choice : null)}/${node ? node.take - node.give : 0}`)
    node = node && node.sub
  }
  // 控制方流转：从 firstPlayer=1 开始，逐块 next
  let c = 1
  const ctrl = []
  node = pred.tree
  for (const b of pred.blocks) {
    ctrl.push(c)
    if (node) { c = node.next; node = node.sub }
  }
  controlSeq.push(...ctrl.map(x => String(x)))

  const row = {
    seed,
    frontier: `D63F1.${mask.toString(36)}`,
    filled: ARBoard.bitCount(mask),
    result, // win/lose/draw（主视角）
    predScore: [p0, p1],
    valueSeq,
    controlSeq,
    valuePlain: pred.blocks.map(b => b.value).join(','),
    controlPlain: ctrl.join('')
  }
  fs.writeSync(fd, JSON.stringify(row) + '\n')
}
fs.closeSync(fd)

console.log(`已收集 ${count} 个局面 → ${outFile}`)
console.log(`主视角: 胜 ${winCount}（${(winCount / count * 100).toFixed(1)}%）· 负 ${loseCount}（${(loseCount / count * 100).toFixed(1)}%）· 平 ${drawCount}`)
