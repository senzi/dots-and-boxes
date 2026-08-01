<script setup>
defineProps({
  player: Object,
  score: Number,
  active: Boolean,
  turn: Boolean,
  ai: Boolean,
  aiThinking: Boolean,
  playerIndex: { type: Number, default: 0 }
})
</script>

<template>
  <div v-if="player" class="player-card" :class="[{ on: active }, playerIndex === 0 ? 'pidx0' : 'pidx1']">
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
</template>

<style scoped>
.player-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--card);
  border: 1px solid var(--hairline);
  border-radius: var(--r-xl);
  padding: 16px 18px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}
.player-card.on {
  border-color: var(--ink);
  box-shadow: var(--shadow-soft);
}
/* 换手提示：当前行动方带玩家色淡底 */
.player-card.on.pidx0 { background: var(--p1-fill); }
.player-card.on.pidx1 { background: var(--p2-fill); }
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
</style>
