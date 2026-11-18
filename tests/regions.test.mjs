import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { Group, Vector3 } from 'three'
import { createServer } from 'vite'

const loader = await createServer({server:{middlewareMode:true},appType:'custom'})
const {DetailRegions} = await loader.ssrLoadModule('/src/runtime/resources.ts')
after(() => loader.close())
const tick = () => new Promise(resolve => setImmediate(resolve))
const eye = x => new Vector3(x,0,0)

test('late results stay detached, hysteresis preserves a nearby region, revisits reuse it',async() => {
  const scene = new Group(), stop = new AbortController()
  const regions = new DetailRegions(scene,stop.signal,()=>{})
  let resolve, attempts=0
  regions.add({anchor:[0,0,0],enter:3,exit:5,build:() => { attempts++; return new Promise(done => { resolve=done }) }})
  regions.update(eye(10))
  assert.equal(attempts,0)
  regions.update(eye(1)); await tick()
  regions.update(eye(20))
  resolve(new Group()); await tick()
  assert.equal(scene.children.length,0)
  regions.update(eye(1))
  regions.update(eye(4))
  assert.equal(scene.children.length,1)
  regions.update(eye(8))
  assert.equal(scene.children.length,0)
  regions.update(eye(1))
  assert.equal(attempts,1)
})

test('eviction bounds the inactive cache without removing an active region',async() => {
  const regions = new DetailRegions(new Group(),new AbortController().signal,()=>{})
  let builds=0, retired=0
  for (let i=0;i<32;i++) regions.add({
    anchor:[i*100,0,0],enter:5,exit:7,
    build:() => { builds++; return new Group() }, evict:() => { retired++ }
  })
  for (let i=0;i<32;i++) { regions.update(eye(i*100)); await tick() }
  assert.equal(regions.active,1)
  assert.equal(regions.built,25)
  assert.equal(retired,7)
  regions.update(eye(0)); await tick()
  assert.equal(builds,33)
  assert.equal(regions.active,1)
})

test('nearby work is prioritized and in-flight builds are bounded',async() => {
  const region = new DetailRegions(new Group(),new AbortController().signal,()=>{})
  const started=[], releases=[]
  for (const x of [5,1,4]) region.add({anchor:[x,0,0],enter:8,exit:10,build:() => {
    started.push(x)
    return new Promise(done=>releases.push(()=>done(new Group())))
  }})
  for(let i=0;i<4;i++){region.update(eye(0)); await tick()}
  assert.deepEqual(started,[1,4])
  releases[0](); await tick()
  region.update(eye(0)); await tick()
  assert.deepEqual(started,[1,4,5])
  releases.slice(1).forEach(release=>release())
  await tick()
  assert.equal(region.active,3)
})
