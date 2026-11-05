import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { startIdleTimer } from './idle'

beforeEach(() => {
    vi.useFakeTimers()
})
afterEach(() => {
    vi.useRealTimers()
})

it('fires once the idle time passes without activity', () => {
    const onIdle = vi.fn()
    startIdleTimer(30 * 60_000, onIdle)
    vi.advanceTimersByTime(30 * 60_000 - 1)
    expect(onIdle).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onIdle).toHaveBeenCalledTimes(1)
})

it('counts the idle time from the last activity', () => {
    const onIdle = vi.fn()
    const timer = startIdleTimer(1000, onIdle)
    vi.advanceTimersByTime(900)
    timer.touch()
    vi.advanceTimersByTime(900)
    timer.touch()
    vi.advanceTimersByTime(999)
    expect(onIdle).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onIdle).toHaveBeenCalledTimes(1)
})

it('never fires after stop', () => {
    const onIdle = vi.fn()
    const timer = startIdleTimer(1000, onIdle)
    timer.stop()
    vi.advanceTimersByTime(5000)
    expect(onIdle).not.toHaveBeenCalled()
})
