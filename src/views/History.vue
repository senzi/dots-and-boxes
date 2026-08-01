<script setup>
import { computed } from 'vue'
import { useHistoryStore } from '../stores/settings.js'

const history = useHistoryStore()

const fmtTime = (ts) => {
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const modeLabel = (m) => m === 'ai' ? '人机' : '本地'

function pct(wins, games) {
  return games ? Math.round((wins / games) * 100) : 0
}
</script>

<template>
  <div class="page fade-up">
    <div class="row-between">
      <router-link to="/" class="btn btn-text">← 返回</router-link>
      <button class="btn btn-text muted" @click="history.clear()">清空记录</button>
    </div>

    <h1 class="display display-lg mt-16">历史战绩</h1>

    <!-- 玩家统计 -->
    <div class="stats-grid mt-24">
      <div v-for="s in history.stats" :key="s.id" class="card stat-card">
        <div class="avatar">{{ s.avatar }}</div>
        <div class="col flex-1">
          <span class="pname">{{ s.name }}</span>
          <span class="body-sm muted">{{ s.games }} 场 · {{ s.wins }} 胜 · 胜率 {{ pct(s.wins, s.games) }}%</span>
        </div>
        <div class="stat-win">{{ s.wins }}</div>
      </div>
      <div v-if="!history.stats.length" class="card body-sm muted" style="grid-column: 1/-1">
        暂无记录，去下一局吧。
      </div>
    </div>

    <!-- 最近对局 -->
    <h2 class="display display-sm mt-32">最近对局</h2>
    <div v-if="history.recent.length" class="mt-16 col gap-8">
      <div v-for="(r, i) in history.recent" :key="i" class="card row gap-16 rec-row">
        <div class="col" style="width: 130px; flex-shrink: 0">
          <span class="badge">{{ modeLabel(r.mode) }}<template v-if="r.aiLevel"> · L{{ r.aiLevel }}</template></span>
          <span class="body-sm muted mt-8">{{ fmtTime(r.date) }}</span>
        </div>
        <div class="row gap-8 flex-1">
          <span>{{ r.players[0]?.avatar }}</span>
          <span class="pname">{{ r.players[0]?.name }}</span>
          <span class="muted"> {{ r.score[0] }} : {{ r.score[1] }} </span>
          <span>{{ r.players[1]?.avatar }}</span>
          <span class="pname">{{ r.players[1]?.name }}</span>
        </div>
        <span v-if="r.result === 'draw'" class="badge">平局</span>
        <span v-else-if="r.winnerId === r.players[0]?.id" class="badge" style="background: var(--surface-strong)">P1 胜</span>
        <span v-else class="badge" style="background: var(--surface-strong)">P2 胜</span>
      </div>
    </div>
    <p v-else class="body-sm muted mt-16">还没有对局。</p>
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.stat-card { display: flex; align-items: center; gap: 14px; }
.stat-win {
  font-family: var(--font-display);
  font-size: 32px;
  font-weight: 300;
}
.pname { font-weight: 500; }
.rec-row { padding: 16px 20px; }
@media (max-width: 640px) {
  .rec-row { flex-wrap: wrap; }
}
</style>
