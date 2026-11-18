import type { Object3D, PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export type Point = readonly number[]
export interface View {
  id: string
  label: string
  position: Point
  target: Point
  fov?: number
}
export interface Detail {
  anchor: Point
  enter: number
  exit: number
  build: (signal: AbortSignal) => Object3D | Promise<Object3D>
  evict?: (root: Object3D) => void
}
export interface WorldContext {
  scene: Scene
  camera: PerspectiveCamera
  renderer: WebGLRenderer
  controls: OrbitControls
  signal: AbortSignal
  report(message: string): void
  onFrame(fn: (elapsed: number, delta: number) => void): void
  onDispose(fn: () => void): void
  registerDetail(spec: Detail): void
}
