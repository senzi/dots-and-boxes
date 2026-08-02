import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const Frontier = require('../src/frontier.js')
const ValueBot = require('../src/value-bot.js')
const Protocol = require('../src/protocol.js')

const raw = process.argv.slice(2).join(' ').trim()
const match = raw.match(/(?:protocol=)?(D63V1\.[a-z0-9]+\.[a-z0-9]+\.[a-z0-9]+\.(?:_|[a-z0-9-]+))/i)
if (!match) throw new Error('usage: node tools/inspect-protocol.mjs "D63V1...."')
const decoded = Protocol.decodeValueCode(match[1])
const valid = Frontier.validate(decoded.frontier)
if (!valid.ok) throw new Error(valid.error)
const state = ValueBot.create(decoded.frontier)
const rows = []
for (let index = 0; index < decoded.step; index++) {
  const block = ValueBot.next(state)
  rows.push({ step: index + 1, value: block.value, handout: block.handout, openingEdge: block.openingEdge, expectedEdge: decoded.openings[index], match: block.openingEdge === decoded.openings[index], exact: block.handoutExact })
}
console.log(JSON.stringify({ result: rows.every(row => row.match) ? 'PASS' : 'MISMATCH', frontier: Protocol.frontierCode(decoded.frontier), seed: decoded.seed, rows }, null, 2))
