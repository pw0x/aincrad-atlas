import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function loadGeometries(url, signal) {
  const response = await fetch(url, {signal});
  if (!response.ok) throw Error('无法读取地景网格 '+response.status);
  const bytes = await response.arrayBuffer();
  signal.throwIfAborted();
  const model = await new GLTFLoader().parseAsync(bytes, '');
  const meshes = [];
  model.scene.traverse(node => {
    if (!node.isMesh) return;
    meshes.push(node.geometry);
    node.material.dispose();
  });
  if (signal.aborted) {
    meshes.forEach(g=>g.dispose());
    signal.throwIfAborted();
  }
  return meshes;
}
