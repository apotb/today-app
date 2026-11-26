import { spawnSync } from 'node:child_process'

function lanHost() {
  if (process.env.IOS_API_HOST) return process.env.IOS_API_HOST
  for (const iface of ['en0', 'en1']) {
    const result = spawnSync('ipconfig', ['getifaddr', iface], { encoding: 'utf8' })
    const ip = result.stdout?.trim()
    if (result.status === 0 && ip) return ip
  }
  return null
}

const host = lanHost()
const apiBase = process.env.VITE_API_BASE ?? (host ? `http://${host}:4000/api` : '')
if (!apiBase) {
  console.error('No LAN address found. Set IOS_API_HOST or VITE_API_BASE, then run this again.')
  process.exit(1)
}

console.log(`iOS API base: ${apiBase}`)

const build = spawnSync('npm', ['run', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_API_BASE: apiBase },
})
if (build.status !== 0) process.exit(build.status ?? 1)

const sync = spawnSync('npx', ['cap', 'sync', 'ios'], { stdio: 'inherit' })
process.exit(sync.status ?? 1)
