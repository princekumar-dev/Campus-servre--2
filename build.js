import { spawnSync } from 'node:child_process'
import path from 'node:path'

// Render hosts only the Express backend. Vercel hosts the Vite frontend.
// Some existing Render services have a fixed "npm install; npm run build"
// command, so make that command safe even when devDependencies are omitted.
if (String(process.env.RENDER || '').toLowerCase() === 'true') {
  console.log('Render backend deployment detected; skipping Vite frontend build.')
  process.exit(0)
}

const viteCli = path.resolve('node_modules', 'vite', 'bin', 'vite.js')
const result = spawnSync(process.execPath, [viteCli, 'build'], {
  stdio: 'inherit',
  env: process.env
})

if (result.error) {
  console.error(`Unable to start Vite: ${result.error.message}`)
  process.exit(1)
}

process.exit(result.status ?? 1)
