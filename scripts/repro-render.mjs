// SSR 渲染复现测试 —— 定位热座开局渲染爆栈
// 用法：npx vite-node scripts/repro-render.mjs
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import App from '../src/App.vue'
import Game from '../src/views/Game.vue'
import { useGameStore } from '../src/stores/game.js'

const pinia = createPinia()
setActivePinia(pinia)

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div>home</div>' } },
    { path: '/game', component: Game }
  ]
})

const game = useGameStore()
game.start('hotseat', [
  { id: 'p1', name: '小猫', avatar: '🐱' },
  { id: 'p2', name: '狐狸', avatar: '🦊' }
], 1)

await router.push('/game')
await router.isReady()

console.log('— 测试 3：完整 App（RouterView）+ /game —')
const app = createSSRApp(App)
app.use(pinia)
app.use(router)
try {
  const html = await renderToString(app)
  console.log('App 渲染成功，html 长度:', html.length)
} catch (e) {
  console.log('App 渲染失败:', e.constructor.name, e.message)
  console.log((e.stack || '').split('\n').slice(0, 18).join('\n'))
}
