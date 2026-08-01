import { createRouter, createWebHashHistory } from 'vue-router'
import Home from './views/Home.vue'
import Game from './views/Game.vue'
import History from './views/History.vue'
import Settings from './views/Settings.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/game', component: Game },
    { path: '/history', component: History },
    { path: '/settings', component: Settings }
  ]
})
