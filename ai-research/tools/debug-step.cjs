// 验证 step 比分连续性
const Board = require('../src/board.js')
const ValueBot = require('../src/value-bot.js')
const Outcome = require('../src/outcome.js')
const Frontier = require('../src/frontier.js')

const frontier = Frontier.generate(20260806)
const blocks = Outcome.decompose(frontier)
console.log('总块数:', blocks.length, '价值序列:', blocks.map(b => b.value).join(','))
console.log('块A:', blocks[0].label, 'value:', blocks[0].value, 'control:', blocks[0].controlCode)

const res = Outcome.outcome(frontier, 0)
console.log('全盘 outcome(0):', res.score, 'winner:', res.winner)
console.log('tree 根: choice:', res.tree.choice, 'take:', res.tree.take, 'give:', res.tree.give, 'next:', res.tree.next)

// step=1：块 A 消解后
const view = ValueBot.snapshotAt(frontier, blocks, 1)
console.log('A 消解后 mask 剩余边:', Board.legal(view.mask).length)
const sub = Outcome.outcome(view.mask, 1)
console.log('outcome(A后, 控制方1):', sub.score, 'winner:', sub.winner)
console.log('剩余块数:', sub.blocks.length, '剩余价值序列:', sub.blocks.map(b => b.value).join(','))
console.log('原序列 blocks[1..]:', blocks.slice(1).map(b => b.value).join(','))

// 全盘 tree 的剩余部分（块 B 起，控制方 1）
console.log('--- 全盘 tree.sub（块B 决策）---')
console.log('choice:', res.tree.sub.choice, 'take:', res.tree.sub.take, 'give:', res.tree.sub.give, 'cTotal:', res.tree.sub.cTotal, 'oppTotal:', res.tree.sub.oppTotal)
// 递归打印 tree 决策（验证全盘最优路径）
let node = res.tree, idx = 0
while (node && idx < blocks.length) {
  console.log(`块${blocks[idx].label} 值${blocks[idx].value} ${node.choice} take=${node.take} give=${node.give} next=${node.next} cTotal=${node.cTotal}`)
  node = node.sub; idx++
}

