<script setup>
import { ref, computed } from 'vue'
import { useHistoryStore } from '../stores/settings.js'
import Board from '../components/Board.vue'
import { SIZES } from '../engine/board.js'

const history = useHistoryStore()

const fmtTime = (ts) => {
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const modeLabel = (m) => m === 'ai' ? '人机' : '本地'

// 棋盘尺寸标签
function sizeLabel(id) {
  const s = SIZES.find(x => x.id === id)
  return s ? s.label.replace('格', '') : '8×8'
}
function gridOf(id) {
  const s = SIZES.find(x => x.id === id)
  return s ? s.grid : 8
}

// 终盘查看
const selected = ref(null)
function open(rec) {
  if (!rec.board) return
  selected.value = rec
}
function close() {
  selected.value = null
}
const selGrid = computed(() => selected.value ? gridOf(selected.value.boardSize) : 8)

function resultBadge(rec) {
  if (rec.result === 'draw') return { text: '平局', cls: '' }
  if (rec.winnerId === rec.players?.[0]?.id) return { text: 'P1 胜', cls: 'w1' }
  return { text: 'P2 胜', cls: 'w2' }
}
</script>

<template>
  <div class="page fade-up" style="max-width: 760px">
    <div class="row-between">
      <router-link to="/" class="btn btn-text">← 返回</router-link>
      <button class="btn btn-text muted" @click="history.clear()">清空记录</button>
    </div>

    <h1 class="display display-lg mt-16">最近对局</h1>
    <p class="body-sm muted mt-8">点击任意对局可查看终盘局面。</p>

    <div v-if="history.recent.length" class="mt-16 col gap-8">
      <button
        v-for="(r, i) in history.recent" :key="i"
        class="card row gap-16 rec-row" @click="open(r)"
      >
        <div class="col" style="width: 118px; flex-shrink: 0; text-align: left">
          <span class="badge">{{ modeLabel(r.mode) }}<template v-if="r.aiLevel"> · L{{ r.aiLevel }}</template></span>
          <span class="caption muted mt-8" style="text-transform: none; letter-spacing: 0">{{ fmtTime(r.date) }}</span>
        </div>
        <div class="row gap-8 flex-1">
          <span>{{ r.players[0]?.avatar }}</span>
          <span class="pname">{{ r.players[0]?.name }}</span>
          <span class="muted"> {{ r.score[0] }} : {{ r.score[1] }} </span>
          <span>{{ r.players[1]?.avatar }}</span>
          <span class="pname">{{ r.players[1]?.name }}</span>
        </div>
        <span class="badge size-badge">{{ sizeLabel(r.boardSize) }}</span>
        <span v-if="r.result === 'draw'" class="badge">平局</span>
        <span v-else-if="r.winnerId === r.players[0]?.id" class="badge">P1 胜</span>
        <span v-else class="badge">P2 胜</span>
      </button>
    </div>
    <p v-else class="body-sm muted mt-16">还没有对局。</p>

    <!-- 终盘详情 -->
    <div v-if="selected" class="overlay" @click.self="close">
      <div class="card-soft replay-card fade-up">
        <div class="row-between">
          <span class="caption">{{ modeLabel(selected.mode) }} · {{ sizeLabel(selected.boardSize) }} · {{ fmtTime(selected.date) }}</span>
          <button class="btn btn-text muted" @click="close">关闭 ✕</button>
        </div>
        <div class="row-between mt-16">
          <div class="row gap-8">
            <span class="avatar sm">{{ selected.players[0]?.avatar }}</span>
            <span class="pname">{{ selected.players[0]?.name }}</span>
          </div>
          <div class="row gap-12">
            <span class="score-num" style="color: var(--p1)">{{ selected.score[0] }}</span>
            <span class="muted">:</span>
            <span class="score-num" style="color: var(--p2)">{{ selected.score[1] }}</span>
          </div>
          <div class="row gap-8">
            <span class="pname">{{ selected.players[1]?.name }}</span>
            <span class="avatar sm">{{ selected.players[1]?.avatar }}</span>
          </div>
        </div>
        <div class="board-wrap mt-16">
          <Board
            v-if="selected.board"
            :board="selected.board"
            :players="selected.players"
            :grid-size="selGrid"
            :interactive="false"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pname { font-weight: 500; }
.rec-row {
  padding: 16px 20px;
  cursor: pointer;
  border: 1px solid var(--hairline);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  text-align: left;
  width: 100%;
  font-family: var(--font-body);
  font-size: 16px;
  color: var(--ink);
  background: var(--card);
}
.rec-row:hover { border-color: var(--ink); box-shadow: var(--shadow-soft); }
.size-badge { background: var(--canvas-soft); }

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
.replay-card { width: 100%; max-width: 560px; }
.board-wrap { width: 100%; }
.avatar.sm { width: 32px; height: 32px; font-size: 16px; }
.score-num { font-family: var(--font-display); font-size: 28px; font-weight: 300; }

@media (max-width: 640px) {
  .rec-row { flex-wrap: wrap; }
}
</style>
