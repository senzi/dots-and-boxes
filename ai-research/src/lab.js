(function () {
  'use strict'
  const { Board, Frontier, ValueBot, Protocol } = D63
  const palette = ['#34d6c7','#ff826d','#68a7ff','#c89cff','#f2cb66','#55d886','#ff9fc5','#9aa7ff']
  const $ = id => document.getElementById(id)
  const canvas = $('board'), ctx = canvas.getContext('2d')
  let state = null, step = 0, seed = 20260806, calculating = false

  function copyText(text) {
    const fallback = () => {
      const area = document.createElement('textarea'); area.value = text; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove()
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(() => $('status').textContent = '已复制当前块全部信息。').catch(fallback)
    else { fallback(); $('status').textContent = '已复制当前块全部信息。' }
  }

  function parseMask(raw) {
    const value = raw.trim()
    if (value.startsWith('D63F1.')) return Protocol.parseBase36(value.slice(6))
    return BigInt(value)
  }

  function visibleState() { return state ? ValueBot.snapshotAt(state.frontier, state.blocks, step) : null }

  function drawBoard(view) {
    const W = canvas.width, pad = 62, cell = (W - pad * 2) / Board.N
    ctx.clearRect(0, 0, W, W); ctx.fillStyle = '#0a1211'; ctx.fillRect(0, 0, W, W)
    ctx.fillStyle = 'rgba(255,255,255,.025)'; ctx.fillRect(pad, pad, cell, cell)
    if (view) for (const box of Board.boxes) {
      const owner = view.boxBlock[box.index]
      if (owner < 0) continue
      const color = palette[owner % palette.length], x = pad + box.c * cell, y = pad + box.r * cell
      ctx.globalAlpha = .18; ctx.fillStyle = color; ctx.fillRect(x + 6, y + 6, cell - 12, cell - 12); ctx.globalAlpha = 1
      const block = view.blocks[owner]
      ctx.fillStyle = color; ctx.font = `700 ${Math.max(13, cell * .17)}px Consolas,monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${block.label}:${block.value}`, x + cell / 2, y + cell / 2)
    }
    const current = step ? state.blocks[step - 1] : null
    for (const edge of Board.edges) {
      let color = '#1f302c', width = 3, alpha = .5
      if (view && Board.has(view.frontier, edge.index)) { color = '#647571'; width = 5; alpha = .9 }
      else if (view && view.edgeOwners.has(edge.index)) { color = palette[view.edgeOwners.get(edge.index) % palette.length]; width = 6; alpha = 1 }
      if (current && edge.index === current.openingEdge) { color = '#f2cb66'; width = 10; alpha = 1 }
      if (current && edge.index === current.handoutEdge) { color = '#c89cff'; width = 9; alpha = 1 }
      const x1 = pad + edge.c * cell, y1 = pad + edge.r * cell, x2 = x1 + (edge.dir === 'H' ? cell : 0), y2 = y1 + (edge.dir === 'V' ? cell : 0)
      ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
    }
    ctx.globalAlpha = 1
    for (let r = 0; r <= Board.N; r++) for (let c = 0; c <= Board.N; c++) {
      if (r === 0 && c === 0) continue
      ctx.fillStyle = '#c9d6d2'; ctx.beginPath(); ctx.arc(pad + c * cell, pad + r * cell, 5.2, 0, Math.PI * 2); ctx.fill()
    }
    ctx.fillStyle = '#8fa39d'; ctx.font = '700 15px Consolas,monospace'; ctx.textAlign = 'center'
    for (let c = 0; c < Board.N; c++) ctx.fillText(String.fromCharCode(65 + c), pad + (c + .5) * cell, pad - 25)
    ctx.textAlign = 'right'; for (let r = 0; r < Board.N; r++) ctx.fillText(String(r + 1), pad - 22, pad + (r + .55) * cell)
  }

  function render() {
    if (!state) { drawBoard(null); return }
    const view = visibleState(), blocks = state.blocks.slice(0, step), current = blocks.at(-1)
    drawBoard(view)
    $('slider').max = state.blocks.length; $('slider').value = step
    $('first').disabled = calculating || step === 0; $('prev').disabled = calculating || step === 0
    $('last').disabled = calculating || step === state.blocks.length; $('next').disabled = calculating || state.complete && step === state.blocks.length
    $('sequence').textContent = blocks.map(block => block.value).join(' · ') || '—'
    $('boxesDone').textContent = `${blocks.reduce((sum, block) => sum + block.value, 0)} / 63`
    const ones = blocks.filter(block => block.value === 1).length, twos = blocks.filter(block => block.value === 2).length
    $('flipParity').textContent = `${ones}（${ones % 2 ? '奇' : '偶'}）`
    $('twoParity').textContent = `${twos}（${twos % 2 ? '奇' : '偶'}）`
    $('handouts').textContent = `${blocks.filter(b=>b.handout===2).length} / ${blocks.filter(b=>b.handout===4).length} / ${blocks.filter(b=>b.handout===0).length}`
    $('progress').textContent = state.complete ? `${step}/${state.blocks.length} · 完成` : `${step}/${state.blocks.length} · 按需`
    // 控制权转移序列：按时间（消解顺序）逐块标记 必然/可能/不转移
    const seqText = { FORCED_FLIP: '必然转移', TAKE_ALL: '必然转移', CHALLENGE_2: '可能转移', KEEP_BY_2: '保权·不转移', KEEP_BY_4: '保权·不转移', GAME_END: '终局' }
    $('controlSeq').innerHTML = blocks.length ? blocks.map((b, i) => {
      const cls = b.controlCode === 'GAME_END' ? 'end' : b.controlCode === 'FORCED_FLIP' || b.controlCode === 'TAKE_ALL' ? 'force' : b.controlCode === 'CHALLENGE_2' ? 'maybe' : 'keep'
      return `<div class="seq-row ${cls}"><span class="seq-idx">${String(i + 1).padStart(2)}</span><b>${b.label}</b><span>${seqText[b.controlCode] || b.controlCode}</span><span>让${b.handout}</span></div>`
    }).join('') : '<p>逐步计算后显示。</p>'
    // 全盘价值轨迹：倒序（最新在最上），并随回撤步数缩短
    const trail = blocks.slice().reverse()
    $('blockList').innerHTML = trail.length ? trail.map((block, index) => `<div class="block-row ${index === 0 ? 'active' : ''}"><b>${block.label}</b><span title="不保留控制权（全吃）价值">值${block.value}</span><span title="保留控制权时控制方净吃">${block.controlCode.startsWith('KEEP') ? `保权${block.controlTake}` : '—'}</span><span>让${block.handout} ${block.controlLabel}</span></div>`).join('') : '<p>点击“分析下一块”。</p>'
    if (!current) $('current').innerHTML = `安全前沿已填 ${Board.bitCount(state.frontier)} 条边。<br>下一步将枚举所有开边，选择完整吃取价值最小的区块。`
    else {
      const keepLabel = current.controlCode.startsWith('KEEP') ? '保留控制权' : '不保留控制权'
      $('current').innerHTML = `<b>块 ${current.label} · 价值 ${current.value}${current.controlCode.startsWith('KEEP') ? `（保权后吃 ${current.controlTake}）` : ''}</b><br>开边：${Board.edgeText(current.openingEdge)}<br>自动吃：${current.captureMoves.length} 手；格子：${current.boxes.map(box=>Board.boxes[box].label).join('、')}<br>对战留法：让 <b>${current.handout}</b>，控制方净吃 ${current.controlTake} · ${keepLabel}<br><span style="color:var(--gold)">${current.controlLabel}</span><br>同值最小块=${current.equivalentMinimumBlocks}；留法搜索=${current.handoutExact?'精确':'达到节点上限'} / ${current.searchNodes} 节点；${current.computeMs} ms`
    }
  }

  function load(frontier, nextSeed) {
    const valid = Frontier.validate(frontier); if (!valid.ok) throw new Error(valid.error)
    seed = nextSeed; state = ValueBot.create(frontier); step = 0
    $('loadCode').value = Protocol.frontierCode(frontier); $('slider').max = 0
    $('status').textContent = `前沿完成：${Board.bitCount(frontier)} 条边。尚未分析价值块。`; render()
  }

  function calculateNext() {
    if (!state || calculating) return
    if (step < state.blocks.length) { step++; render(); return }
    if (state.complete) { $('status').textContent = '全盘价值块已经解析完成。'; return }
    calculating = true; $('status').textContent = `正在分析第 ${state.blocks.length + 1} 个价值块…`; render()
    setTimeout(() => {
      try { const block = ValueBot.next(state); step = state.blocks.length; $('status').textContent = block ? `识别 ${block.label}：价值 ${block.value}，让 ${block.handout}，${block.computeMs} ms。` : '分析完成。' }
      catch (error) { $('status').textContent = error.message }
      finally { calculating = false; render() }
    }, 20)
  }

  $('generate').onclick = () => { try { seed = Number($('seed').value) || 1; $('status').textContent = '正在生成安全前沿…'; setTimeout(() => { try { load(Frontier.generate(seed), seed) } catch (error) { $('status').textContent = error.message } }, 20) } catch (error) { $('status').textContent = error.message } }
  $('random').onclick = () => { const words = new Uint32Array(1); crypto.getRandomValues(words); $('seed').value = words[0] || Date.now() >>> 0 }
  $('load').onclick = () => { try { load(parseMask($('loadCode').value), Number($('seed').value) || 1) } catch (error) { $('status').textContent = error.message } }
  $('next').onclick = calculateNext; $('prev').onclick = () => { if (step) { step--; render() } }; $('first').onclick = () => { step = 0; render() }; $('last').onclick = () => { step = state.blocks.length; render() }
  $('slider').oninput = event => { step = Number(event.target.value); render() }
  $('copyAll').onclick = () => state ? copyText(Protocol.debugBundle(state, seed, step)) : $('status').textContent = '请先生成安全前沿。'
  addEventListener('keydown', event => { if (event.target.matches('input,textarea')) return; if (event.key === 'ArrowLeft' && step) { step--; render() } else if (event.key === 'ArrowRight') calculateNext() })
  drawBoard(null)
})()
