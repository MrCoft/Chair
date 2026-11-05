export type IdleTimer = { touch: () => void; stop: () => void }

export function startIdleTimer(idleMs: number, onIdle: () => void): IdleTimer {
    let timer = setTimeout(onIdle, idleMs)
    return {
        touch() {
            clearTimeout(timer)
            timer = setTimeout(onIdle, idleMs)
        },
        stop() {
            clearTimeout(timer)
        },
    }
}
