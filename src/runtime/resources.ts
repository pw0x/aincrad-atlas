import { Box3, Material, Object3D, Texture, Vector3 } from 'three'
import type { BufferGeometry, Mesh } from 'three'
import type { Detail } from './api'

export function disposeObjects(roots: Object3D[]) {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const textures = new Set<Texture>()
  for (const root of roots) root.traverse(node => {
    const mesh = node as Mesh
    if (mesh.geometry) geometries.add(mesh.geometry)
    if (mesh.material) {
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      list.forEach(material => materials.add(material))
    }
    if ('isInstancedMesh' in node && 'dispose' in node) (node as {dispose():void}).dispose()
  })
  for (const material of materials) {
    for (const property of Object.values(material)) if (property instanceof Texture) textures.add(property)
    material.dispose()
  }
  geometries.forEach(geometry => geometry.dispose())
  textures.forEach(texture => texture.dispose())
}

interface Region {
  spec: Detail
  center: Vector3
  bounds: Box3
  wanted: boolean
  pending: boolean
  root?: Object3D
  retryAfter: number
}
interface Branch { bounds: Box3, leaves?: Region[], left?: Branch, right?: Branch }

function tree(regions: Region[]): Branch {
  const bounds = new Box3()
  for (const region of regions) bounds.union(region.bounds)
  if (regions.length <= 8) return {bounds, leaves:regions}
  const span = bounds.getSize(new Vector3())
  const axis = span.x > span.z && span.x > span.y ? 'x' : span.z > span.y ? 'z' : 'y'
  regions.sort((a,b) => a.center[axis]-b.center[axis])
  const half = Math.floor(regions.length/2)
  return {bounds, left:tree(regions.slice(0,half)), right:tree(regions.slice(half))}
}

function visit(branch: Branch, eye: Vector3, found: Region[]) {
  if (!branch.bounds.containsPoint(eye)) return
  if (branch.leaves) {
    for (const region of branch.leaves) if (region.bounds.containsPoint(eye)) found.push(region)
  } else {
    visit(branch.left!,eye,found)
    visit(branch.right!,eye,found)
  }
}

export class DetailRegions {
  private regions: Region[] = []
  private index?: Branch
  private eye = new Vector3(Infinity,Infinity,Infinity)
  private near: Region[] = []
  private detached = new Map<Region,Object3D>()
  private inFlight = 0
  constructor(private readonly scene: Object3D, private readonly signal: AbortSignal, private readonly invalidate: () => void) {}

  add(spec: Detail) {
    if (spec.enter <= 0 || spec.exit < spec.enter || spec.anchor.length !== 3) throw Error('Invalid detail region')
    const center = new Vector3().fromArray(spec.anchor)
    const bounds = new Box3(center.clone().addScalar(-spec.exit),center.clone().addScalar(spec.exit))
    this.regions.push({ spec, center, bounds, wanted:false, pending:false, retryAfter:0 })
    this.index = undefined
  }

  update(eye: Vector3) {
    if (!this.index || !this.eye.equals(eye)) {
      this.index ??= tree(this.regions.slice())
      const nearby: Region[] = []
      visit(this.index,eye,nearby)
      const within = nearby.filter(region => {
        const radius = region.wanted ? region.spec.exit : region.spec.enter
        return eye.distanceToSquared(region.center) <= radius*radius
      })
      const wanted = new Set(within)
      for (const old of this.near) {
        if (wanted.has(old)) continue
        old.wanted = false
        if (old.root) {
          old.root.removeFromParent()
          this.park(old,old.root)
          this.invalidate()
        }
      }
      for (const region of within) {
        region.wanted = true
        if (region.root && !region.root.parent) {
          this.detached.delete(region)
          this.scene.add(region.root)
          this.invalidate()
        }
      }
      this.near = within.sort((a,b) => eye.distanceToSquared(a.center)-eye.distanceToSquared(b.center))
      this.eye.copy(eye)
    }
    if (this.inFlight >= 2 || this.signal.aborted) return
    const now = performance.now()
    const next = this.near.find(region => !region.root && !region.pending && now >= region.retryAfter)
    if (!next) return
    next.pending = true
    this.inFlight++
    Promise.resolve().then(() => next.spec.build(this.signal)).then(root => {
      if (this.signal.aborted) return disposeObjects([root])
      next.root = root
      if (next.wanted) { this.scene.add(root); this.invalidate() }
      else this.park(next,root)
    }).catch(error => {
      next.retryAfter = performance.now()+15000
      if (!this.signal.aborted) console.error('局部细节加载失败', error)
    }).finally(() => { next.pending = false; this.inFlight-- })
  }

  private park(region: Region, root: Object3D) {
    this.detached.set(region,root)
    if (this.detached.size <= 24) return
    const oldest = this.detached.keys().next().value!
    const retired = this.detached.get(oldest)!
    this.detached.delete(oldest)
    // Source meshes, materials and scan textures belong to their scene pools.
    // Instance buffers belong to the retired batch and may be freed immediately.
    if (oldest.spec.evict) oldest.spec.evict(retired)
    else retired.traverse(node => {
      if ('isInstancedMesh' in node && 'dispose' in node) (node as {dispose():void}).dispose()
    })
    oldest.root = undefined
  }

  get active() { return this.regions.filter(region => region.root?.parent).length }
  get total() { return this.regions.length }
  get built() { return this.regions.filter(region => region.root).length }
  get roots() { return this.regions.flatMap(region => region.root ? [region.root] : []) }
}
