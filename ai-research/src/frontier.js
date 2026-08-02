(function (root, factory) {
  const api = factory(root.D63 && root.D63.Board)
  if (typeof module === 'object' && module.exports) module.exports = api
  root.D63 = root.D63 || {}
  root.D63.Frontier = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Board) {
  'use strict'
  if (!Board && typeof require === 'function') Board = require('./board.js')

  function mulberry32(seed) {
    let value = seed >>> 0
    return function () {
      value |= 0
      value = value + 0x6D2B79F5 | 0
      let t = Math.imul(value ^ value >>> 15, 1 | value)
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
      return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
  }

  function generate(seed) {
    const rng = mulberry32(seed)
    let mask = 0n
    let lastMove = null
    while (true) {
      const safe = Board.legal(mask).filter(edge => Board.danger(mask, edge) === 0)
      if (!safe.length) return mask
      let choices = safe
      if (lastMove != null) {
        const prior = Board.edges[lastMove]
        const touches = safe.filter(index => {
          const edge = Board.edges[index]
          const endpoints = e => e.dir === 'H'
            ? [[e.c, e.r], [e.c + 1, e.r]]
            : [[e.c, e.r], [e.c, e.r + 1]]
          return endpoints(edge).some(a => endpoints(prior).some(b => a[0] === b[0] && a[1] === b[1]))
        })
        if (touches.length) choices = touches
      }
      lastMove = choices[Math.floor(rng() * choices.length)]
      mask = Board.put(mask, lastMove)
    }
  }

  function validate(mask) {
    if (mask < 0n || mask > Board.FULL_MASK) return { ok: false, error: 'mask 超出棋盘范围' }
    if (Board.degrees(mask).some(value => value > 2)) return { ok: false, error: '存在三边或四边格，不是安全局面' }
    if (Board.legal(mask).some(edge => Board.danger(mask, edge) === 0)) return { ok: false, error: '仍有安全边，不是极大安全前沿' }
    return { ok: true }
  }

  return { mulberry32, generate, validate }
})
