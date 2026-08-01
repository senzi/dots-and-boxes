<script setup>
// SVG 棋盘 —— (grid+1)×(grid+1) 点阵，去掉左上角点
import { computed } from 'vue'
import { edgeId, isEdgeUsable } from '../engine/board.js'

const props = defineProps({
  board: { type: Object, required: true },   // {edges, boxes}
  players: { type: Array, default: () => [] }, // [{avatar}]
  lastMove: { type: Object, default: null },    // {dir,r,c,player}
  interactive: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false },
  gridSize: { type: Number, default: 8 }      // 方格数（8 或 6）
})
const emit = defineEmits(['place'])

const G = computed(() => props.gridSize)      // 方格数
const P = computed(() => props.gridSize + 1)  // 点数

const M = 34      // margin
const CELL = 64   // 点间距
const SIZE = computed(() => M * 2 + (P.value - 1) * CELL)

const px = (c) => M + c * CELL
const py = (r) => M + r * CELL

// 水平边 H(r,c)：点(r,c) → 点(r,c+1)
const hEdges = computed(() => {
  const list = []
  for (let r = 0; r < P.value; r++) {
    for (let c = 0; c < G.value; c++) {
      if (!isEdgeUsable('H', r, c)) continue
      list.push({ id: edgeId('H', r, c), r, c, x1: px(c), y1: py(r), x2: px(c + 1), y2: py(r) })
    }
  }
  return list
})
// 垂直边 V(r,c)：点(r,c) → 点(r+1,c)
const vEdges = computed(() => {
  const list = []
  for (let r = 0; r < G.value; r++) {
    for (let c = 0; c < P.value; c++) {
      if (!isEdgeUsable('V', r, c)) continue
      list.push({ id: edgeId('V', r, c), r, c, x1: px(c), y1: py(r), x2: px(c), y2: py(r + 1) })
    }
  }
  return list
})

const allEdges = computed(() => [...hEdges.value, ...vEdges.value])
const lastMoveId = computed(() => props.lastMove
  ? edgeId(props.lastMove.dir, props.lastMove.r, props.lastMove.c)
  : null)

// 完成的格子
const boxes = computed(() => {
  const list = []
  for (let r = 0; r < G.value; r++) {
    for (let c = 0; c < G.value; c++) {
      if (r === 0 && c === 0) continue
      const owner = props.board.boxes[`${r}-${c}`]
      if (owner !== null && owner !== undefined) {
        list.push({ r, c, owner, x: px(c), y: py(r) })
      }
    }
  }
  return list
})

// 被移除的角点标记
const removedDot = { x: px(0), y: py(0) }

// 点阵（不含被移除角点）
const dots = computed(() => {
  const list = []
  for (let r = 0; r < P.value; r++) {
    for (let c = 0; c < P.value; c++) {
      if (r === 0 && c === 0) continue
      list.push({ r, c, x: px(c), y: py(r) })
    }
  }
  return list
})

function onPlace(e) {
  if (props.disabled || !props.interactive) return
  emit('place', { dir: e.dir, r: e.r, c: e.c })
}
</script>

<template>
  <svg
    :viewBox="`0 0 ${SIZE} ${SIZE}`"
    class="board-svg"
    role="img"
    aria-label="Dots and Boxes 63 棋盘"
  >
    <!-- 格子填充（先画，在边下面） -->
    <g v-for="b in boxes" :key="`b-${b.r}-${b.c}`">
      <rect
        :x="b.x + 2" :y="b.y + 2"
        :width="CELL - 4" :height="CELL - 4"
        rx="10"
        :class="b.owner === 0 ? 'box-fill p1' : 'box-fill p2'"
      />
      <text
        :x="b.x + CELL / 2" :y="b.y + CELL / 2"
        text-anchor="middle" dominant-baseline="central"
        class="box-owner"
      >{{ players[b.owner]?.avatar || '' }}</text>
    </g>

    <!-- 边 -->
    <g
      v-for="e in allEdges"
      :key="e.id"
      class="edge"
      :class="[
        board.edges[e.id] !== null ? 'placed' : '',
        board.edges[e.id] === 0 ? 'p1' : '',
        board.edges[e.id] === 1 ? 'p2' : '',
        e.id === lastMoveId ? 'last-move' : ''
      ]"
    >
      <line v-if="e.id === lastMoveId" class="last-move-halo" :x1="e.x1" :y1="e.y1" :x2="e.x2" :y2="e.y2" />
      <line :x1="e.x1" :y1="e.y1" :x2="e.x2" :y2="e.y2" />
      <!-- 命中区：横向或纵向细长矩形 -->
      <rect
        v-if="e.y1 === e.y2"
        :x="e.x1" :y="e.y1 - 12" :width="CELL" :height="24"
        fill="transparent"
        @click="onPlace({ dir: e.id.split('-')[0], r: e.r, c: e.c })"
      />
      <rect
        v-else
        :x="e.x1 - 12" :y="e.y1" :width="24" :height="CELL"
        fill="transparent"
        @click="onPlace({ dir: e.id.split('-')[0], r: e.r, c: e.c })"
      />
    </g>

    <!-- 点 -->
    <circle
      v-for="p in dots"
      :key="`dot-${p.r}-${p.c}`"
      :cx="p.x" :cy="p.y" r="3.5" class="dot"
    />

    <!-- 被移除角点 -->
    <g class="removed">
      <line :x1="removedDot.x - 8" :y1="removedDot.y - 8" :x2="removedDot.x + 8" :y2="removedDot.y + 8" />
      <line :x1="removedDot.x - 8" :y1="removedDot.y + 8" :x2="removedDot.x + 8" :y2="removedDot.y - 8" />
    </g>
  </svg>
</template>

<style scoped>
.board-svg {
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
  touch-action: manipulation;
}

/* 边 */
.edge line {
  stroke: var(--hairline-strong);
  stroke-width: 2.5;
  stroke-linecap: round;
  transition: stroke 0.1s ease, stroke-width 0.1s ease;
}
.edge:hover line {
  stroke: var(--ink);
  stroke-width: 5;
  cursor: pointer;
}
.edge.placed { pointer-events: none; }
.edge.placed.p1 line { stroke: var(--p1); stroke-width: 5; }
.edge.placed.p2 line { stroke: var(--p2); stroke-width: 5; }
.edge.p1:hover line { stroke: var(--p1); }
.edge.p2:hover line { stroke: var(--p2); }
.edge.placed.last-move .last-move-halo {
  stroke: #f59e0b;
  stroke-width: 13;
  opacity: 0.88;
  filter: drop-shadow(0 0 5px rgba(245, 158, 11, 0.9));
  animation: last-move-pulse 1.1s ease-in-out infinite alternate;
}
@keyframes last-move-pulse {
  from { opacity: 0.58; stroke-width: 11; }
  to { opacity: 0.95; stroke-width: 14; }
}

/* 点 */
.dot { fill: var(--ink); }

/* 被移除角点 */
.removed line {
  stroke: var(--muted-soft);
  stroke-width: 2;
  stroke-linecap: round;
}

/* 格子 */
.box-fill { stroke: none; }
.box-fill.p1 { fill: var(--p1-fill); }
.box-fill.p2 { fill: var(--p2-fill); }
.box-owner {
  font-size: 22px;
  pointer-events: none;
  opacity: 0.85;
}

/* 棋盘容器暗化：不可交互时 */
.board-svg.dim { opacity: 0.7; }
</style>
