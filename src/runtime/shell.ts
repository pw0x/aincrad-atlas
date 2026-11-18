import type { View } from './api'

export type World = 'cabin' | 'castle' | 'town'
const paths = {
  compass: '<path d="m12 2 4 7 5 3-5 3-4 7-4-7-5-3 5-3z"/><path d="m12 6 1 5 4 1-4 1-1 5-1-5-4-1 4-1z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 10.5v6m0-10v.8"/>',
  expand: '<path d="M8.5 4H4v4.5M15.5 4H20v4.5M20 15.5V20h-4.5M8.5 20H4v-4.5"/>',
  hide: '<path d="M2 12s3.7-6.5 10-6.5S22 12 22 12s-3.7 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  arrow: '<path d="m7 17 10-10M8 7h9v9"/>'
}
const agentPrompt = `请作为平级贡献者加入「浮游城图志」，和其他 agent 在 GitHub 上共同搭建可探索的艾因格朗特。

先完整克隆仓库并进入项目目录。
git clone https://github.com/pw0x/aincrad-atlas.git
cd aincrad-atlas

如果已有克隆，请核对上游地址，fetch 最新 main，并基于它创建工作分支或独立 worktree，保留已有的本地工作。

先读 AGENTS.md、README.zh-CN.md、docs/WORLD_DESIGN.md 和 CONTRIBUTING.md，了解世界愿景、场景边界和协作约定。查看 GitHub 的开放 Issues 和 PR，选择或提出一项可独立验收的工作。在 Issue 里认领，说明范围、依赖和验收方式，再开始制作。

在分支上交付。代码或素材改动运行 npm ci、npm test、npm run build，视觉改动另附同机位前后截图。通过 GitHub PR 关联 Issue，写清结果、依据和验证方法。交接时留下一条可复用的经验、遇到的协作卡点或流程改进建议，以及下一位 agent 能接手的具体步骤。`

function icon(name: keyof typeof paths) {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[name]+'</svg>'
}
function button(id: string, label: string, image: keyof typeof paths) {
  return '<button class="icon" id="'+id+'" aria-label="'+label+'" title="'+label+'">'+icon(image)+'</button>'
}

const lore = {
  castle: {
    title: '艾因格朗特', en: 'AINCRAD', section: '全城外观', sectionEn: 'THE FLOATING CASTLE',
    canon: '川原砾在第一卷开篇写到，一座由岩石与钢铁构成的巨城悬于空中。基底层直径约十公里，向上叠起一百层。《Progressive》第一卷进一步写明了城体向上收窄的轮廓。',
    interpretation: '本场景按米构建基底和百层外缘。具体檐口、城翼构造、明暗节奏、植被与岩体断面属于此次外观设计，一百层的室内世界留给各楼层独立制作。',
    sources: [['第一卷 · 授权试读，第 10 页','https://cdn.palmknihy.cz/prod-media-assets/01HHYC58KAA77HTEVBDKT1MQ6P/book_362079_51.pdf#page=10'],['Yen Press · 艾因格朗特','https://yenpress.com/titles/9780316371247-sword-art-online-1-aincrad-light-novel']]
  },
  town: {
    title: '起始之镇', en: 'TOWN OF BEGINNINGS', section: '第一层', sectionEn: 'FLOOR ONE',
    canon: '动画第一季第一话「剣の世界」中，桐人与克莱因被传送回起始之镇的广场，听到茅场晶彦对玩家的宣告。本场景取这个地点，描绘另一个平静的集市时刻。',
    interpretation: '这里搭建了广场的一段街区。钟楼、市集平面、星盘泉池、上层底板的截面和运货花车均为原创补完。摊上的地图是以第一层为题的幻想测绘图。',
    sources: [['动画官网 · 第一话「剣の世界」','https://www.swordart-onlineusa.com/aincrad/story/?no=01']]
  },
  cabin: {
    title: '湖畔木屋', en: 'LAKESIDE CABIN', section: '第二十二层', sectionEn: 'FLOOR TWENTY-TWO',
    canon: '动画第十一话把桐人与亚丝娜的家安在第二十二层湖边。川原砾在《The Day Before》中写到屋后的针叶林、白木板装修的起居室，以及摆在室内的圆桌。',
    interpretation: '按上述关系安排湖岸、木屋和家具。房屋尺度、门饰花纹、双人早餐和窗边的湖岸手记是本次美术补完。',
    sources: [['动画官网 · 第十一话「朝露の少女」','https://www.swordart-onlineusa.com/aincrad/story/?no=11'],['KADOKAWA · 收录短篇的第二十二卷','https://www.kadokawa.co.jp/product/321904000061/']]
  }
}

export function shell(world: World) {
  const data = lore[world]
  const el = document.querySelector<HTMLElement>('#atlas')!
  el.innerHTML = `
    <canvas id="world" aria-label="${data.title}，可拖动环绕或滚轮缩放" tabindex="0"></canvas>
    <div class="shade" aria-hidden="true"></div><div class="shutter" aria-hidden="true"></div>
    <header class="top ui">
      <a href="./index.html" class="brand" aria-label="浮游城图志 · 浮游城全景">${icon('compass')}<span>浮游城图志<small>AINCRAD ATLAS</small></span></a>
      <nav class="worlds" aria-label="场景"><a href="./index.html"${world==='castle'?' aria-current="page"':''}>浮游城</a><a href="./floor-01.html"${world==='town'?' aria-current="page"':''}>起始之镇</a><a href="./floor-22.html"${world==='cabin'?' aria-current="page"':''}>湖畔木屋</a></nav>
      <button type="button" id="join-agent" aria-haspopup="dialog" aria-controls="join-dialog">让我的agent参与这个项目</button>
      <div class="tools">${button('info','设定与操作','info')}${button('full','全屏','expand')}${button('hide','隐藏界面 (H)','hide')}</div>
    </header>
    <div class="caption ui">
      <div class="chapter"><i></i>${data.section}<span> / </span>${data.sectionEn}</div>
      <h1>${data.title}</h1><div class="english">${data.en}</div>
    </div>
    <div class="dock ui"><div class="dock-label"><span>观察视角</span><span id="view-counter"></span></div><div class="views" aria-label="观察视角"></div></div>
    <button class="reveal icon" aria-label="显示界面 (H)" title="显示界面 (H)">${icon('hide')}</button>
    <div class="load" aria-live="polite"><span class="load-line"></span><span id="status">正在展开场景…</span></div>
    <dialog id="scene-info"><div class="sheet-header"><span class="eyebrow">AINCRAD ATLAS</span>${button('close','关闭','close')}</div>
      <h2>${data.title}</h2><h3>原作依据</h3><p>${data.canon}</p>
      <div class="source-links">${data.sources.map(([label,link])=>'<a href="'+link+'" target="_blank" rel="noopener">'+label+icon('arrow')+'</a>').join('')}</div>
      <h3>场景补完</h3><p>${data.interpretation}</p><h3>观察操作</h3><p>拖动环绕，滚轮缩放，右键拖动平移。触屏可双指缩放和平移。数字键切换视角，H 键切换界面。</p>
      <div class="source-links"><a href="https://github.com/pw0x/aincrad-atlas" target="_blank" rel="noopener">参与共建 · GitHub</a><a href="https://github.com/pw0x/aincrad-atlas/blob/main/docs/LICENSING.md" target="_blank" rel="noopener">Aincrad Atlas contributors · 授权与署名</a></div>
      <details id="metrics"><summary>实时渲染数据</summary><output></output></details>
    </dialog>
    <dialog id="join-dialog" aria-labelledby="join-title" aria-describedby="join-instructions">
      <div class="sheet-header"><h2 id="join-title">让 agent 参与共建</h2>${button('join-close','关闭参与提示','close')}</div>
      <p id="join-instructions">复制这段提示词，发给你的 Codex、Claude 或其他 agent。</p>
      <textarea id="join-prompt" readonly aria-label="给 agent 的提示词" spellcheck="false"></textarea>
      <div class="join-actions">
        <button type="button" id="join-copy" autofocus>复制提示词</button>
        <a href="https://github.com/pw0x/aincrad-atlas" target="_blank" rel="noopener">GitHub 仓库 ${icon('arrow')}</a>
      </div>
      <p role="status" id="join-status"></p>
    </dialog>`
  const get = <T extends HTMLElement>(selector: string) => el.querySelector<T>(selector)!
  const dialog = get<HTMLDialogElement>('#scene-info')
  const joinDialog = get<HTMLDialogElement>('#join-dialog')
  const prompt = get<HTMLTextAreaElement>('#join-prompt')
  const copyStatus = get('#join-status')
  prompt.value = agentPrompt
  get('#join-agent').onclick = () => {
    copyStatus.textContent = ''
    joinDialog.showModal()
  }
  get('#join-close').onclick = () => joinDialog.close()
  get('#join-copy').onclick = async () => {
    let copied = false
    try {
      await navigator.clipboard.writeText(prompt.value)
      copied = true
    } catch {
      prompt.focus()
      prompt.select()
      try { copied = document.execCommand('copy') } catch { /* The text stays selected for manual copy. */ }
    }
    copyStatus.textContent = copied ? '提示词已复制，可以发给你的 agent。' : '提示词已全选，请使用系统的复制操作。'
  }
  const canvas = get<HTMLCanvasElement>('canvas')
  const status = get('#status')
  const load = get('.load')
  let immersive = false
  function toggleUI() {
    immersive = !immersive
    el.classList.toggle('immersive',immersive)
    el.querySelectorAll<HTMLElement>('.ui').forEach(element => element.inert = immersive)
    if (immersive) canvas.focus({preventScroll:true})
  }
  get('#hide').onclick = toggleUI
  get('.reveal').onclick = toggleUI
  get('#info').onclick = () => dialog.showModal()
  get('#close').onclick = () => dialog.close()
  for (const panel of [dialog, joinDialog]) {
    panel.onclick = event => {
      if (event.target !== panel) return
      const box = panel.getBoundingClientRect()
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) panel.close()
    }
  }
  const full = get<HTMLButtonElement>('#full')
  full.hidden = !document.fullscreenEnabled
  full.onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch { full.hidden = true }
  }
  const buttons: HTMLButtonElement[] = []
  const counter = get('#view-counter')
  return {
    canvas, dialog, joinDialog,
    toggleUI, metrics: get<HTMLDetailsElement>('#metrics'), output: get('output'),
    report(message: string) { status.textContent = message },
    ready() { el.dataset.ready = 'true'; load.hidden = true },
    fail(message: string) {
      load.hidden = false; load.classList.add('error'); status.textContent = message
      const retry = document.createElement('button')
      retry.textContent = '重新载入'; retry.onclick = () => location.reload(); load.append(retry)
    },
    setViews(views: View[], select: (i: number) => void) {
      const host = get('.views')
      views.forEach((view,i) => {
        const b = document.createElement('button')
        b.textContent = view.label; b.title = view.label+' ('+(i+1)+')'; b.onclick = () => select(i)
        buttons.push(b); host.append(b)
      })
    },
    markView(index: number) {
      buttons.forEach((b,i) => b.setAttribute('aria-pressed',String(i===index)))
      buttons[index]?.scrollIntoView({block:'nearest',inline:'nearest'})
      counter.textContent = String(index+1).padStart(2,'0')+' / '+String(buttons.length).padStart(2,'0')
    },
    shade(dark: boolean) { el.classList.toggle('changing',dark) }
  }
}
