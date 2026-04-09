import { spawn } from 'node:child_process'

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
