import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
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

const internalWebhookWorkerToken =
  process.env.INTERNAL_WEBHOOK_WORKER_TOKEN || randomUUID()
const runtimePort = process.env.PORT || '3000'
const workerBaseUrl = `http://127.0.0.1:${runtimePort}`

const child = spawn(process.execPath, ['.next/standalone/server.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    HOSTNAME: '0.0.0.0',
    INTERNAL_WEBHOOK_WORKER_TOKEN: internalWebhookWorkerToken,
  },
})

let workerRunning = false
let workerTimer = null

const runInternalWebhookWorker = async () => {
  if (workerRunning || child.killed || process.env.DISABLE_INTERNAL_WEBHOOK_WORKER === 'true') return
  workerRunning = true

  try {
    await fetch(`${workerBaseUrl}/api/internal/open-api/process-webhook-outbox?limit=25`, {
      method: 'POST',
      headers: {
        'x-internal-worker-token': internalWebhookWorkerToken,
      },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined)
  } finally {
    workerRunning = false
  }
}

if (process.env.DISABLE_INTERNAL_WEBHOOK_WORKER !== 'true') {
  const initialKick = setTimeout(() => {
    void runInternalWebhookWorker()
  }, 4_000)
  initialKick.unref?.()

  workerTimer = setInterval(() => {
    void runInternalWebhookWorker()
  }, 5_000)
  workerTimer.unref?.()
}

const forwardSignal = (signal) => {
  if (workerTimer) clearInterval(workerTimer)
  if (child.killed) return
  child.kill(signal)
}

process.on('SIGINT', forwardSignal)
process.on('SIGTERM', forwardSignal)

child.on('exit', (code, signal) => {
  if (workerTimer) clearInterval(workerTimer)
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
