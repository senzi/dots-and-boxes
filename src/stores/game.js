// 对局状态
import { defineStore } from 'pinia'
import {
  createBoard, placeEdge, isGameOver, scores, remainingEdges, legalMoves
} from '../engine/board.js'
import { getAiMove, aiMoveDelay } from '../engine/ai.js'

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export const MODES = {
  face: { id: 'face', label: '面对面 · iPad', desc: '平板横放，两人对坐' },
  hotseat: { id: 'hotseat', label: '电脑热座', desc: '一台电脑轮流操作' },
  ai: { id: 'ai', label: '人机对战', desc: '与 AI 对弈，三档难度' }
}

export const useGameStore = defineStore('game', {
  state: () => ({
    mode: null,          // 'face' | 'hotseat' | 'ai'
    aiLevel: 1,
    players: [],         // [{id,name,avatar}]
    board: null,         // {edges, boxes}
    current: 0,          // 当前行动玩家 index
    lastMove: null,      // {dir,r,c,player}
    lastGain: [],        // 最近一次落子完成的格子
    over: false,
    winner: null,        // 0 | 1 | -1(平局)
    aiThinking: false,
    moveCount: 0
  }),

  getters: {
    scores: (s) => s.board ? scores(s.board) : [0, 0],
    remEdges: (s) => s.board ? remainingEdges(s.board) : 0,
    currentPlayer: (s) => s.players[s.current] || null,
    isAiTurn: (s) => s.mode === 'ai' && s.current === 1 && !s.over
  },

  actions: {
    start(mode, players, aiLevel = 1) {
      this.mode = mode
      this.aiLevel = aiLevel
      this.players = players
      this.board = createBoard()
      this.current = 0
      this.lastMove = null
      this.lastGain = []
      this.over = false
      this.winner = null
      this.aiThinking = false
      this.moveCount = 0
      // AI 先手（随机决定谁先，简单起见玩家先手；AI 模式固定玩家先手）
      if (mode === 'ai' && Math.random() < 0.08) {
        // 小概率 AI 先手，增加变化
        this.triggerAi()
      }
    },

    // 玩家落子。返回是否完成格子（继续行动）
    tryPlace(dir, r, c) {
      if (this.over || this.aiThinking || (this.mode === 'ai' && this.current === 1)) return { ok: false, gained: 0 }
      return this.applyMove(dir, r, c)
    },

    applyMove(dir, r, c) {
      const player = this.current
      const res = placeEdge(this.board, dir, r, c, player)
      if (!res.ok) return res
      this.moveCount++
      this.lastMove = { dir, r, c, player }
      this.lastGain = res.completed
      if (res.gained === 0) {
        this.current = 1 - player
      }
      this.checkEnd()
      return res
    },

    checkEnd() {
      if (isGameOver(this.board)) {
        this.over = true
        const [a, b] = scores(this.board)
        this.winner = a > b ? 0 : b > a ? 1 : -1
      }
    },

    // 触发 AI 行动（带思考延迟）
    triggerAi() {
      if (this.over) return
      if (!(this.mode === 'ai' && this.current === 1)) return
      if (this.aiThinking) return
      this.aiThinking = true
      const level = this.aiLevel
      const state = this.board
      const delay = aiMoveDelay(level)
      setTimeout(() => {
        const move = getAiMove(level, state, 1)
        if (move) {
          this.applyMove(move.dir, move.r, move.c)
        }
        this.aiThinking = false
        // 如果 AI 吃格连锁后还是自己回合，继续
        if (!this.over && this.mode === 'ai' && this.current === 1) {
          this.triggerAi()
        }
      }, delay)
    },

    // 外部入口：轮到 AI 时调用
    maybeAi() {
      if (this.isAiTurn) this.triggerAi()
    },

    reset() {
      this.start(this.mode, this.players, this.aiLevel)
    }
  }
})
