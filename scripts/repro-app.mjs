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
game.start('hotseat', [{ id: 'p1', name: '小猫', avatar: '🐱' }, { id: 'p2', name: '狐狸', avatar: '🦊' }], 1)
await router.push('/game')
await router.isReady()
console.log('route:', router.currentRoute.value.path)
const app = createSSRApp(App)
app.use(pinia)
app.use(router)
const html = await renderToString(app)
console.log('HTML:', html.slice(0, 400))
