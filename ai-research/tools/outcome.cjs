// 终盘收益预测：node tools/outcome.cjs <D63F1...> [firstPlayer]
// firstPlayer: 轮到谁开块（0/1，默认 0）
const Board = require('../src/board.js')
const Protocol = require('../src/protocol.js')
const Outcome = require('../src/outcome.js')

const code = process.argv[2]
if (!code) { console.error('用法: node tools/outcome.cjs <D63F1... 或 mask> [firstPlayer]'); process.exit(1) }
const frontier = code.startsWith('D63F1.') ? Protocol.parseBase36(code.slice(6)) : BigInt(code)
const first = Number(process.argv[3] || 0)

const t0 = Date.now()
const result = Outcome.outcome(frontier, first)
const ms = Date.now() - t0

const [a, b] = result.score
const names = first === 0 ? ['先手', '后手'] : ['后手(先开)', '先手(后开)']
console.log(`前沿已填 ${Board.bitCount(frontier)} 边 · 价值块 ${result.blocks.length} 个 · 计算 ${ms}ms`)
console.log(`价值序列: ${result.blocks.map(x => x.value).join(',')}`)
console.log(`控制序列: ${result.blocks.map(x => x.controlCode === 'GAME_END' ? 'E' : x.controlCode[0] === 'K' ? x.controlCode.slice(-1) : x.controlCode[0]).join(',')}`)
console.log(`终盘收益: ${names[0]} ${a} : ${b} ${names[1]}`)
console.log(`胜负: ${result.winner === -1 ? '平局' : (result.winner === first ? '先手胜' : '后手胜')}`)

// 决策路径（最优）
function path(node, index) {
  if (!node) return
  const block = result.blocks[index]
  const cName = index === 0 ? (first === 0 ? '先手' : '后手') : '控制方'
  console.log(`${'  '.repeat(index)}块${block.label} 值${block.value} (${cName}) · ${node.choice} → 吃${node.take}/让${node.give} 累计${node.cTotal}:${node.oppTotal}`)
  path(node.sub, index + 1)
}
path(result.tree, 0)
