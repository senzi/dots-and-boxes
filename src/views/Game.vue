<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Board from '../components/Board.vue'
import { useGameStore } from '../stores/game.js'
import { useHistoryStore } from '../stores/settings.js'
import { AI_LEVELS } from '../engine/ai.js'

const router = useRouter()
const game = useGameStore()
const history = useHistoryStore()

const saved = ref(false)
const toast = ref('')

const isFace = computed(() => game.mode === 'face')
const scores = computed(() => game.scores)
const aiLevelName = computed(() => {
  const lv = AI_LEVELS.find(l => l.id === game.aiLevel)
  return lv ? lv.name : ''
})

// 落子
function onPlace({ dir, r, c }) {
  if (game.over || game.aiThinking) return
  const res = game.tryPlace(dir, r, c)
  if (res.ok && res.gained > 0) {
    showToast(`${game.players[game.current]?.name || '玩家'} 围成 ${res.gained} 格，继续行动`)
  }
}

function showToast(msg) {
  toast.value = msg
  setTimeout(() => { if (toast.value === msg) toast.value = '' }, 1800)
}

// AI 回合触发
watch(() => game.isAiTurn, (v) => {
  if (v) game.triggerAi()
})

// 游戏结束 → 保存记录（只存一次）
watch(() => game.over, (v) => {
  if (v && !saved.value) {
    saved.value = true
    const mode = game.mode === 'ai' ? 'ai' : 'local'
    const [a, b] = scores.value
    history.add({
      date: Date.now(),
      mode,
      aiLevel: game.mode === 'ai' ? game.aiLevel : null,
      players: game.players.map((p, i) => ({ ...p, score: i === 0 ? a : b })),
      result: game.winner === -1 ? 'draw' : 'win',
      winnerId: game.winner === -1 ? null : game.players[game.winner]?.id,
      score: [a, b]
    })
  }
})

function again() {
  saved.value = false
  toast.value = ''
  game.reset()
}

// 防误触返回
function goHome() {
  if (game.over || confirm('退出本局？')) router.push('/')
}

onMounted(() => {
  // 直接访问 /game 但没有对局 → 回首页
  if (!game.board) router.replace('/')
})
</script>

<template>
  <div class="page game-page fade-up">
    <!-- 顶栏 -->
    <div class="row-between">
      <button class="btn btn-text" @click="goHome">← 退出</button>
      <div class="row gap-8">
        <span v-if="game.mode === 'ai'" class="badge">AI · {{ aiLevelName }}</span>
        <span class="badge">剩余 {{ game.remEdges }} 边</span>
      </div>
    </div>

    <!-- 面对面：左右玩家 + 中央棋盘 -->
    <div v-if="isFace" class="face-layout">
      <div class="side-panel" :class="{ active: !game.over && game.current === 0 }">
        <PlayerCard :player="game.players[0]" :score="scores[0]" :active="!game.over && game.current === 0" :turn="!game.over && game.current === 0" />
      </div>
      <div class="board-wrap">
        <Board :board="game.board" :players="game.players" :disabled="game.over || game.aiThinking" @place="onPlace" />
        <div v-if="toast" class="toast">{{ toast }}</div>
      </div>
      <div class="side-panel rot180" :class="{ active: !game.over && game.current === 1 }">
        <PlayerCard :player="game.players[1]" :score="scores[1]" :active="!game.over && game.current === 1" :turn="!game.over && game.current === 1" />
      </div>
    </div>

    <!-- 热座 / AI：上方玩家条 + 中央棋盘 -->
    <div v-else class="stack-layout">
      <div class="players-bar">
        <PlayerCard
          :player="game.players[0]" :score="scores[0]"
          :active="!game.over && game.current === 0"
          :turn="!game.over && game.current === 0 && !game.aiThinking"
        />
        <div class="vs muted">VS</div>
        <PlayerCard
          :player="game.players[1]" :score="scores[1]"
          :active="!game.over && game.current === 1"
          :turn="!game.over && game.current === 1 && !game.aiThinking"
          :ai="game.mode === 'ai'"
          :ai-thinking="game.aiThinking"
        />
      </div>
      <div class="board-wrap">
        <Board :board="game.board" :players="game.players" :disabled="game.over || game.aiThinking || game.isAiTurn" @place="onPlace" />
        <div v-if="toast" class="toast">{{ toast }}</div>
      </div>
    </div>

    <!-- 游戏结束 -->
    <div v-if="game.over" class="overlay">
      <div class="card-soft result-card fade-up">
        <div class="caption">游戏结束</div>
        <h2 class="display display-lg mt-8">
          <template v-if="game.winner === -1">平局</template>
          <template v-else>{{ game.players[game.winner]?.avatar }} {{ game.players[game.winner]?.name }} 获胜</template>
        </h2>
        <div class="row gap-24 mt-16 result-score">
          <div class="score-num" :style="{ color: 'var(--p1)' }">{{ scores[0] }}</div>
          <div class="muted score-sep">:</div>
          <div class="score-num" :style="{ color: 'var(--p2)' }">{{ scores[1] }}</div>
        </div>
        <p class="body-sm muted mt-8">共 {{ game.players[0].name }} {{ scores[0] }} 格 · {{ game.players[1].name }} {{ scores[1] }} 格 · 63 格制</p>
        <div class="row gap-12 mt-24">
          <button class="btn btn-primary btn-lg flex-1" @click="again">再来一局</button>
          <button class="btn btn-outline btn-lg" @click="goHome">返回首页</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// 玩家卡片（局部组件）
export default {
  name: 'PlayerCard',
  props: {
    player: Object,
    score: Number,
    active: Boolean,
    turn: Boolean,
    ai: Boolean,
    aiThinking: Boolean
  },
  template: `
    <div class="player-card" :class="{ on: active }">
      <div class="avatar" :class="turn ? 'turn-glow' : ''">{{ player.avatar }}</div>
      <div class="col flex-1" style="min-width: 0">
        <div class="row gap-8">
          <span class="pname">{{ player.name }}</span>
          <span v-if="ai" class="badge" style="background: var(--surface-strong)">AI</span>
          <span v-if="aiThinking" class="thinking">思考中…</span>
        </div>
        <div class="body-sm muted">{{ score }} 格</div>
      </div>
      <div class="score-big">{{ score }}</div>
    </div>
  `
}
</script>

<style scoped>
.game-page { max-width: 1000px; }

.face-layout {
  display: flex;
  gap: 24px;
  align-items: center;
  justify-content: center;
  flex: 1;
  margin-top: 16px;
}
.face-layout .side-panel { width: 200px; flex-shrink: 0; }
.face-layout .rot180 { transform: rotate(180deg); }
.face-layout .board-wrap { flex: 1; max-width: 620px; }

.stack-layout { display: flex; flex-direction: column; align-items: center; gap: 20px; margin-top: 16px; }
.players-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 620px;
}
.players-bar .player-card { flex: 1; }
.vs { font-family: var(--font-display); font-size: 20px; }

.board-wrap { position: relative; width: 100%; max-width: 620px; }

.toast {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--ink);
  color: #fff;
  font-size: 14px;
  padding: 8px 16px;
  border-radius: 9999px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.18);
  animation: fadeUp 0.25s ease both;
  white-space: nowrap;
  z-index: 5;
}

/* 玩家卡片 */
.player-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--card);
  border: 1px solid var(--hairline);
  border-radius: var(--r-xl);
  padding: 16px 18px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.player-card.on {
  border-color: var(--ink);
  box-shadow: var(--shadow-soft);
}
.pname {
  font-size: 16px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.score-big {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 300;
}
.thinking { font-size: 12px; color: var(--muted); animation: pulse 1s ease infinite; }
@keyframes pulse { 50% { opacity: 0.4; } }

.avatar.turn-glow { box-shadow: 0 0 0 3px var(--card), 0 0 0 5px var(--ink); }

/* 结束浮层 */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(12, 10, 9, 0.4);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 24px;
}
.result-card { width: 100%; max-width: 420px; text-align: center; }
.result-score { justify-content: center; align-items: baseline; }
.score-num { font-family: var(--font-display); font-size: 64px; font-weight: 300; line-height: 1; }
.score-sep { font-size: 28px; }

/* 响应式 */
@media (max-width: 860px) {
  .face-layout { flex-direction: column; gap: 12px; }
  .face-layout .side-panel { width: 100%; max-width: 620px; }
  .face-layout .rot180 { transform: rotate(0deg); }
  .face-layout .board-wrap { order: -1; }
}
</style>
