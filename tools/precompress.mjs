import { copyFile, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gzip } from 'node:zlib'
import { promisify } from 'node:util'

const compress = promisify(gzip)
async function prepare(folder) {
  for (const entry of await readdir(folder,{withFileTypes:true})) {
    const file = join(folder,entry.name)
    if (entry.isDirectory()) { await prepare(file); continue }
    if (!/\.(html|css|js|glb|bin|json|wasm)$/.test(file)) continue
    const source = await readFile(file)
    const encoded = await compress(source,{level:8})
    if (encoded.length < source.length*.95) await writeFile(file+'.gz',encoded)
  }
}
await Promise.all(['LICENSE', 'LICENSE-ART.txt'].map(file => copyFile(file, join('dist', file))))
await prepare('dist')
