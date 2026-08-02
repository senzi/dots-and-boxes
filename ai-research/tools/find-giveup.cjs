// 找出"应该让权"的关键盘面：DP 最优（先手胜）但恒保权会输，且最优路径含让权决策
// node tools/find-giveup.cjs [扫描seed数]
const Board = require('../src/board.js')
const Frontier = require('../src/frontier.js')
const ValueBot = require('../src/value-bot.js')
const Outcome = require('../src/outcome.js')
const Protocol = require('../src/protocol.js')

const scan = Number(process.argv[2] || 100)
const found = []

function keepScore(frontier) {
  const blocks = Outcome.decompose(frontier)
  let c = 0; const s = [0, 0]
  for (const b of blocks) {
    if (b.controlCode === 'GAME_END') { s[c] += b.value; break }
    if (b.controlCode === 'KEEP_BY_2' || b.controlCode === 'KEEP_BY_4') { s[c] += b.controlTake; s[1 - c] += b.handout }
    else if (b.controlCode === 'CHALLENGE_2') { s[1 - c] += b.value }
    else { s[c] += b.value; c = 1 - c }
  }
  return s
}

function giveupBlocks(blocks, tree) {
  const list = []
  let node = tree, i = 0
  while (node && i < blocks.length) {
    if (node.choice && node.choice.includes('翻转')) list.push(`块${blocks[i].label} 值${blocks[i].value} ${node.choice}`)
    node = node.sub; i++
  }
  return list
}

for (let seed = 1; seed <= scan; seed++) {
  const frontier = Frontier.generate(seed)
  const dp = Outcome.outcome(frontier, 0)
  const keep = keepScore(frontier)
  // 关键盘面：DP 先手胜，但恒保权先手败（保权会输 → 必须让权）
  if (dp.winner === 0 && keep[0] < keep[1]) {
    const giveups = giveupBlocks(dp.blocks, dp.tree)
    if (giveups.length) {
      found.push({ seed, frontier, dp, keep, giveups })
      if (found.length >= 5) break
    }
  }
}

console.log(`扫描 ${scan} 个 seed，找到 ${found.length} 个'必须让权'盘面：\n`)
found.forEach((f, idx) => {
  console.log(`===== 盘面 ${String.fromCharCode(65 + idx)}（seed=${f.seed}）=====`)
  console.log(`frontier=D63F1.${f.frontier.toString(36)}`)
  console.log(`价值序列: ${f.dp.blocks.map(b => b.value).join(',')}`)
  console.log(`DP 最优:   先手 ${f.dp.score[0]} : ${f.dp.score[1]} 后手（先手胜）`)
  console.log(`恒保权:    先手 ${f.keep[0]} : ${f.keep[1]} 后手（后手胜 ← 保权会输）`)
  console.log(`让权决策:  ${f.giveups.join('、')}`)
  // 完整调试包
  const state = ValueBot.create(f.frontier)
  while (!state.complete) ValueBot.next(state)
  const bundle = Protocol.debugBundle(state, f.seed, state.blocks.length)
  console.log('--- 调试包 ---')
  console.log(bundle.split('\n').filter(l => l.startsWith('protocol=') || l.startsWith('frontier=') || l.startsWith('value_seq') || l.startsWith('control_seq')).join('\n'))
  console.log('')
})
