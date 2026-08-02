// 批量 DP 预测 + 败局收集（预测 = L4 实际，100% 已对齐）
// 增量：seed 30000 起，输出 JSONL（含双序列 + 权属标记）
// node scripts/collect-losing-batch.mjs [数量] [起始seed] [输出文件]
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const ARBoard = require('../ai-research/src/board.js')
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

const count = Number(process.argv[2] || 10000)
const seedBase = Number(process.argv[3] || 30000)
const outFile = process.argv[4] || path.resolve('ai-research/explore/data/losing-batch.jsonl')
fs.mkdirSync(path.dirname(outFile), { recursive: true })

function flagFor(block, choice) {
  if (!choice) return 'forced'
  if (choice.includes('保权')) return 'keep'
  if (block.controlCode === 'FORCED_FLIP' || block.controlCode === 'TAKE_ALL') return 'forced'
  if (block.handoutEdge === null) return 'forced'
  return 'activeGive'
}

const fd = fs.openSync(outFile, 'w')
let lose = 0, win = 0, draw = 0
const t0 = Date.now()
for (let i = 0; i < count; i++) {
  const seed = seedBase + i
  const mask = Frontier.generate(seed)
  const pred = Outcome.outcome(mask, 1)
  const [p0, p1] = pred.score
  const result = p0 > p1 ? 'win' : p0 < p1 ? 'lose' : 'draw'
  if (result === 'lose') lose++
  else if (result === 'win') win++
  else draw++

  const valueSeq = []
  const flags = []
  let node = pred.tree
  for (const b of pred.blocks) {
    valueSeq.push(`${b.value}/${(node && node.choice ? node.choice.replace(/·/g, '') : '?')}/${node ? node.take - node.give : 0}`)
    node = node && node.sub
  }
  let c = 1
  const ctrl = []
  node = pred.tree
  for (let j = 0; j < pred.blocks.length; j++) {
    ctrl.push(c)
    flags.push(flagFor(pred.blocks[j], node ? node.choice : null))
    if (node) { c = node.next; node = node.sub }
  }
  const row = {
    seed, frontier: `D63F1.${mask.toString(36)}`, filled: ARBoard.bitCount(mask),
    result, predScore: [p0, p1], valueSeq, controlSeq: ctrl.map(String), flags,
    valuePlain: pred.blocks.map(b => b.value).join(','), controlPlain: ctrl.join('')
  }
  fs.writeSync(fd, JSON.stringify(row) + '\n')
  if ((i + 1) % 2000 === 0) {
    const dt = ((Date.now() - t0) / 1000).toFixed(0)
    console.log(`进度 ${i + 1}/${count} · 败 ${lose} 胜 ${win} · ${dt}s`)
  }
}
fs.closeSync(fd)
console.log(`完成 ${count} 局 → ${outFile}`)
console.log(`败 ${lose}（${(lose / count * 100).toFixed(1)}%）· 胜 ${win}（${(win / count * 100).toFixed(1)}%）· 耗时 ${((Date.now() - t0) / 1000).toFixed(0)}s`)
