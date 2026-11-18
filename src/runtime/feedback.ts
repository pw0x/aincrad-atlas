import type { CameraPose } from './camera-pose'
import type { World } from './shell'
import './feedback.css'

interface Evidence {
  screenshot: string | null
  camera: CameraPose | null
  view: string
  viewport: {width:number, height:number, dpr:number}
}
interface Submission extends Evidence {
  scene: World
  message: string
  version: string
  requestId: string
}
interface Receipt { id: string, status: string, url?: string }

export function snapshot(canvas: HTMLCanvasElement, draw: () => void): string | null {
  try {
    const image = document.createElement('canvas')
    const scale = Math.min(1, 1280 / Math.max(canvas.width, canvas.height))
    image.width = Math.max(1, Math.round(canvas.width * scale))
    image.height = Math.max(1, Math.round(canvas.height * scale))
    const ctx = image.getContext('2d')
    if (!ctx) return null
    // The default WebGL buffer can be cleared between frames. Copy the completed
    // post-processing pass synchronously without changing preserveDrawingBuffer.
    draw()
    ctx.drawImage(canvas, 0, 0, image.width, image.height)
    for (const quality of [.82, .60, .40]) {
      const encoded = image.toDataURL('image/jpeg', quality)
      if (encoded.startsWith('data:image/jpeg;base64,') && encoded.length <= 1_024_000) return encoded
    }
  } catch { /* A lost context or unavailable encoder still permits a text report. */ }
  return null
}

export function sceneFeedback(
  world: World, dialog: HTMLDialogElement, trigger: HTMLButtonElement, signal: AbortSignal
) {
  const get = <T extends HTMLElement>(selector:string) => dialog.querySelector<T>(selector)!
  const form = get<HTMLFormElement>('#feedback-form')
  const message = get<HTMLTextAreaElement>('#feedback-message')
  const image = get<HTMLImageElement>('figure img')
  const caption = get('figcaption')
  const status = get('#feedback-status')
  const submit = get<HTMLButtonElement>('[type=submit]')
  const redraft = get('#feedback-redraft')
  const exportButton = get('#feedback-export')
  const receiptBar = get('.feedback-receipt')
  const issue = get<HTMLAnchorElement>('#feedback-issue')
  const refresh = get<HTMLButtonElement>('#feedback-refresh')
  const copy = get<HTMLButtonElement>('#feedback-copy')
  const key = 'atlas-feedback-v1-' + world
  const query = new URLSearchParams(location.search)
  const receiptPattern = /^[0-9a-f]{32}$/
  let pending: Submission | null = null
  let evidence: Evidence
  let receipt: Receipt | null = null
  let busy = false, pollTimer = 0
  let capture = (): Pick<Evidence, 'camera'|'screenshot'> => ({camera:null,screenshot:null})
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null') as Submission | null
    if (saved?.scene === world && saved.viewport && typeof saved.requestId === 'string' && typeof saved.message === 'string') pending = saved
  } catch { /* Storage is optional in private browsing. */ }
  let version = import.meta.env.VITE_ATLAS_VERSION || 'unknown'
  const versionReady = version !== 'unknown' ? Promise.resolve() :
    fetch('/api/version', {headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(4000)})
      .then(async response => {
        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
          const body = await response.json()
          if (typeof body.version === 'string') version = body.version
        }
      }).catch(() => {})

  function persist(value: Submission | null) {
    pending = value
    try {
      if (value) sessionStorage.setItem(key, JSON.stringify(value))
      else sessionStorage.removeItem(key)
    } catch { /* In-memory retries still use the same submission ID. */ }
  }
  function replaceParam(name:string, value?:string) {
    const url = new URL(location.href)
    if (value) url.searchParams.set(name,value)
    else url.searchParams.delete(name)
    history.replaceState(history.state,'',url)
  }
  function openForm() {
    clearTimeout(pollTimer)
    if (receipt) message.value = ''
    receipt = null
    evidence = pending ?? {
      ...capture(), view:document.documentElement.dataset.view ?? '',
      viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio || 1}
    }
    image.hidden = !evidence.screenshot
    if (evidence.screenshot) image.src = evidence.screenshot
    else image.removeAttribute('src')
    const label = document.querySelector('.views [aria-pressed=true]')?.textContent
    const viewLabel = pending ? pending.view : label
    caption.textContent = [viewLabel, evidence.screenshot ? '已截取当前画面' : '画面暂时无法截取，可直接提交文字'].filter(Boolean).join(' · ')
    form.hidden = false
    receiptBar.hidden = true
    if (pending) message.value = pending.message
    message.readOnly = !!pending
    redraft.hidden = !pending
    exportButton.hidden = !pending
    submit.textContent = pending ? '重试提交' : '提交反馈'
    status.textContent = pending ? '上次提交尚未确认，重试会沿用同一回执。' : ''
    if (new URLSearchParams(location.search).has('receipt')) replaceParam('receipt')
    if (!dialog.open) dialog.showModal()
    if (!pending) message.focus({preventScroll:true})
  }
  function renderReceipt(value:Receipt) {
    receipt = value
    form.hidden = true
    receiptBar.hidden = false
    copy.textContent = '复制回执链接'
    const publicLink = /^https:\/\/github\.com\/pw0x\/aincrad-atlas\/issues\/\d+$/.test(value.url || '')
    issue.hidden = !publicLink
    if (publicLink) issue.href = value.url!
    else issue.removeAttribute('href')
    refresh.hidden = publicLink
    status.textContent = (publicLink ? '已建立公开任务。' : '反馈已接收，正在等待同步到 GitHub。') + ' 回执 ' + value.id
  }
  async function checkReceipt(attempt = 0) {
    const id = receipt?.id
    if (!id) return
    clearTimeout(pollTimer)
    refresh.disabled = true
    try {
      const response = await fetch('/api/feedback/'+id, {cache:'no-store',signal:AbortSignal.timeout(10000)})
      if (response.status === 404) {
        if (receipt?.id === id) status.textContent = '没有找到这条回执，请核对链接。 回执 '+id
        return
      }
      if (!response.ok) throw Error()
      const result = await response.json() as Receipt
      if (result.id !== id) throw Error()
      if (receipt?.id !== id) return
      renderReceipt(result)
    } catch {
      if (receipt?.id === id) status.textContent = '暂时查不到这条回执。可保存链接，稍后再查看。 回执 '+id
    } finally { refresh.disabled = false }
    if (dialog.open && receipt?.id === id && issue.hidden && attempt < 5) {
      pollTimer = window.setTimeout(() => void checkReceipt(attempt+1), Math.min(15000,2000*(attempt+1)))
    }
  }
  function accept(value:Receipt) {
    persist(null)
    renderReceipt(value)
    replaceParam('receipt',value.id)
    if (dialog.open && issue.hidden) pollTimer = window.setTimeout(() => void checkReceipt(),1500)
  }
  async function send(event:SubmitEvent) {
    event.preventDefault()
    if (busy) return
    const content = message.value.trim()
    if (!content) { message.setCustomValidity('请填写反馈内容。'); message.reportValidity(); return }
    busy = true
    submit.disabled = message.readOnly = true
    redraft.hidden = exportButton.hidden = true
    status.textContent = '正在提交…'
    try {
      await versionReady
      const payload: Submission = pending ?? {...evidence,scene:world,message:content,version,
        requestId:Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2,'0')).join('')}
      persist(payload)
      const response = await fetch('/api/feedback',{
        method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},
        body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)
      })
      if (response.status === 429) {
        status.textContent = '此时段反馈较多。内容已保留，请稍后重试。'
      } else if ([400,413,422].includes(response.status)) {
        persist(null)
        status.textContent = '服务未接受这次提交。请检查内容再试，或保存反馈文件。'
      } else if ([404,405,501].includes(response.status) || !response.headers.get('content-type')?.includes('application/json')) {
        status.textContent = '此站点暂未连接反馈服务。可以保存反馈文件，或稍后重试。'
      } else {
        if (!response.ok) throw Error()
        const body = await response.json() as Receipt
        if (!receiptPattern.test(body.id)) throw Error()
        accept(body)
      }
    } catch {
      status.textContent = '尚未收到服务回执。内容已保留，重试会使用同一提交编号。'
    } finally {
      busy = submit.disabled = false
      message.readOnly = !!pending
      submit.textContent = pending ? '重试提交' : '提交反馈'
      redraft.hidden = !pending
      exportButton.hidden = !!receipt
    }
  }
  trigger.onclick = () => {
    if (!busy && !receipt) return openForm()
    if (!dialog.open) dialog.showModal()
    if (receipt && issue.hidden) void checkReceipt()
  }
  get('#feedback-close').onclick = () => dialog.close()
  dialog.addEventListener('close', () => { clearTimeout(pollTimer) }, {signal})
  message.oninput = () => message.setCustomValidity('')
  form.addEventListener('submit',send,{signal})
  refresh.onclick = () => void checkReceipt()
  copy.onclick = async () => {
    if (!receipt) return
    const url = new URL(location.pathname,location.origin)
    url.searchParams.set('receipt',receipt.id)
    try { await navigator.clipboard.writeText(url.href); copy.textContent = '链接已复制' }
    catch { status.textContent = '当前地址栏即为回执链接，可以直接复制。' }
  }
  function another() {
    persist(null)
    message.value = ''
    openForm()
  }
  redraft.onclick = another
  get('#feedback-another').onclick = openForm
  exportButton.onclick = () => {
    const data = pending ?? {...evidence,scene:world,version,message:message.value}
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'})
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href; a.download = 'aincrad-feedback-'+world+'.json'; a.click()
    window.setTimeout(() => URL.revokeObjectURL(href),1000)
  }
  signal.addEventListener('abort',() => clearTimeout(pollTimer),{once:true})
  const requestedReceipt = query.get('receipt')
  if (requestedReceipt && receiptPattern.test(requestedReceipt)) {
    renderReceipt({id:requestedReceipt,status:'queued'})
    status.textContent = '正在查询回执…'
    dialog.showModal()
    void checkReceipt()
  }
  let requested = !dialog.open && query.get('feedback') === '1'
  return {
    get requested() { return requested },
    setCapture(fn: typeof capture) { capture = fn },
    openRequested() {
      if (!requested) return
      requested = false
      replaceParam('feedback')
      if (!dialog.open) openForm()
    }
  }
}
