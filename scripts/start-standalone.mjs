import { spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

/**
 * Ensure standalone runtime has browser assets and public files.
 * Next standalone server resolves these paths relative to `.next/standalone`.
 */
const syncStandaloneAssets = () => {
  const rootDir = process.cwd()
  const sourceStaticDir = path.join(rootDir, '.next', 'static')
  const sourcePublicDir = path.join(rootDir, 'public')
  const standaloneDir = path.join(rootDir, '.next', 'standalone')
  const targetStaticDir = path.join(standaloneDir, '.next', 'static')
  const targetPublicDir = path.join(standaloneDir, 'public')

  if (existsSync(sourceStaticDir)) {
    mkdirSync(path.dirname(targetStaticDir), { recursive: true })
    cpSync(sourceStaticDir, targetStaticDir, { recursive: true, force: true })
  }

  if (existsSync(sourcePublicDir)) {
    mkdirSync(path.dirname(targetPublicDir), { recursive: true })
    cpSync(sourcePublicDir, targetPublicDir, { recursive: true, force: true })
  }
}

syncStandaloneAssets()

const child = spawn(process.execPath, ['.next/standalone/server.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    HOSTNAME: '0.0.0.0',
  },
})

const forwardSignal = (signal) => {
  if (child.killed) return
  child.kill(signal)
}

process.on('SIGINT', forwardSignal)
process.on('SIGTERM', forwardSignal)

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
