import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { DetailRegions, disposeObjects } from './runtime/resources'
import { createFinish } from './runtime/finish'
import type { View, WorldContext } from './runtime/api'
import { shell, type World } from './runtime/shell'
import './style.css'

const requestedWorld = document.documentElement.dataset.world
const world: World = requestedWorld === 'cabin' || requestedWorld === 'town' ? requestedWorld : 'castle'
const ui = shell(world)
const abort = new AbortController()

async function start() {
  const renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.needsUpdate = true
  renderer.info.autoReset = false
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(42,1,world === 'castle' ? 12 : .025,world === 'castle' ? 200000 : 5000)
  const controls = new OrbitControls(camera,ui.canvas)
  controls.listenToKeyEvents(ui.canvas)
  controls.enableDamping = true
  controls.dampingFactor = .075
  controls.rotateSpeed = .65
  const details = new DetailRegions(scene,abort.signal,() => { renderer.shadowMap.needsUpdate = true })
  const finish = createFinish(renderer,camera,world === 'castle')
  const frames: Array<(elapsed:number,delta:number)=>void> = []
  const cleanup: Array<()=>void> = []
  const ctx: WorldContext = {
    renderer, scene, camera, controls, signal: abort.signal,
    registerDetail: spec => details.add(spec), onFrame: fn => frames.push(fn),
    onDispose: fn => cleanup.push(fn), report: ui.report
  }
  let baseFov = camera.fov
  function fit() {
    const width = ui.canvas.clientWidth, height = ui.canvas.clientHeight
    camera.aspect = width / Math.max(1,height)
    const ratio = Math.max(1, (world === 'castle' ? 1.38 : 1.1)/camera.aspect)
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov/2)) * ratio))
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(window.devicePixelRatio || 1)
    renderer.setSize(width,height,false)
    finish.size()
  }
  fit()
  const sources = import.meta.glob<{build(ctx: WorldContext): Promise<{views: View[]}>}>('./{castle,cabin,town}/index.js')
  const module = await sources['./'+world+'/index.js']()
  const result = await module.build(ctx)
  const views: View[] = result.views
  if (views.length === 0) throw Error('此场景缺少初始观察点')
  const worldFov = camera.fov
  let cutTimer = 0
  function select(i: number, immediate = false) {
    if (!views[i]) return
    const view = views[i]
    const apply = () => {
      if (abort.signal.aborted) return
      // Flush any remaining orbit inertia before placing an authored camera.
      controls.enableDamping = false
      controls.update()
      camera.position.fromArray(view.position)
      controls.target.fromArray(view.target)
      const lens: Record<string,number> = {room:3.5,breakfast:1.9,hearth:2.8,carving:2.6,'field-notes':9}
      finish.setAperture(world === 'cabin' ? (lens[view.id] ?? 0) : 0)
      baseFov = view.fov ?? worldFov
      fit()
      controls.update()
      controls.enableDamping = true
      details.update(camera.position)
      ui.markView(i)
      document.documentElement.dataset.view = view.id
      if (!immediate) history.replaceState(null,'','#'+encodeURIComponent(view.id))
      ui.shade(false)
    }
    clearTimeout(cutTimer)
    if (immediate || matchMedia('(prefers-reduced-motion: reduce)').matches) return apply()
    ui.shade(true)
    cutTimer = window.setTimeout(apply,210)
  }
  ui.setViews(views,select)
  const requested = views.findIndex(v => '#'+encodeURIComponent(v.id)===location.hash)
  select(Math.max(0,requested),true)
  const resize = new ResizeObserver(fit)
  resize.observe(ui.canvas)
  let last = 0, elapsed = 0, sampleTime = 0, sampleFrames = 0, first = true
  function render(milliseconds: number) {
    if (abort.signal.aborted || document.hidden) return
    const dt = last ? Math.min((milliseconds-last)/1000,.1) : 0
    last = milliseconds
    elapsed += dt
    controls.update(dt)
    finish.focus(camera.position.distanceTo(controls.target))
    details.update(camera.position)
    for (const step of frames) step(elapsed,dt)
    renderer.info.reset()
    finish.draw(scene)
    if (first) {
      ui.ready()
      first = false
    }
    sampleFrames++
    if (milliseconds-sampleTime >= 1000) {
      if (ui.metrics.open) {
        const info = renderer.info
        ui.output.textContent = [
          (1000*sampleFrames/(milliseconds-sampleTime)).toFixed(1)+' FPS',
          info.render.calls.toLocaleString()+' 次绘制  ·  '+info.render.triangles.toLocaleString()+' 个三角形',
          info.memory.geometries+' 份几何缓存  ·  '+info.memory.textures+' 份纹理',
          '细节区  '+details.active+' 可见  /  '+details.built+' 已构建  /  '+details.total+' 已登记'
        ].join('\n')
      }
      sampleTime = milliseconds; sampleFrames = 0
    }
  }
  function syncVisibility() {
    const active = !document.hidden && !abort.signal.aborted
    last = 0; sampleTime = performance.now(); sampleFrames = 0
    renderer.setAnimationLoop(active ? render : null)
  }
  function key(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey || ui.dialog.open) return
    if (event.key.toLowerCase() === 'h') ui.toggleUI()
    if (/^[1-9]$/.test(event.key)) select(Number(event.key)-1)
  }
  function dispose() {
    if (abort.signal.aborted) return
    abort.abort()
    clearTimeout(cutTimer)
    renderer.setAnimationLoop(null)
    resize.disconnect()
    controls.dispose()
    cleanup.forEach(fn => fn())
    disposeObjects([scene,...details.roots.filter(root=>!root.parent)])
    finish.dispose()
    renderer.dispose()
  }
  window.addEventListener('keydown',key,{signal:abort.signal})
  document.addEventListener('visibilitychange',syncVisibility,{signal:abort.signal})
  window.addEventListener('pagehide',event => {
    if (event.persisted) renderer.setAnimationLoop(null)
    else dispose()
  },{signal:abort.signal})
  window.addEventListener('pageshow',syncVisibility,{signal:abort.signal})
  ui.canvas.addEventListener('webglcontextlost',event => {
    event.preventDefault()
    renderer.setAnimationLoop(null)
    ui.fail('图形设备连接已中断，可重新载入场景。')
  },{signal:abort.signal})
  syncVisibility()
}

start().catch(error => {
  console.error(error)
  ui.fail('场景未能启动。请确认浏览器已启用 WebGL 2 和图形加速。')
})
