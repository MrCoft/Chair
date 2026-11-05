import { subscribe } from 'node:diagnostics_channel'
import { startIdleTimer } from './idle.ts'

const idleMs = Number(process.env.CHAIR_IDLE_EXIT_MS)
if (idleMs > 0) {
    const timer = startIdleTimer(idleMs, () => process.exit(0))
    subscribe('http.server.request.start', timer.touch)
    subscribe('http.server.response.finish', timer.touch)
}
