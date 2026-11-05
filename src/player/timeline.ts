import type { Step } from '@/format/movie'

export type StepState = 'past' | 'current' | 'upcoming'

export const stepAt = (steps: Array<Step>, ms: number): Step => {
    let found = steps[0]
    for (const step of steps) {
        if (step.startMs > ms) break
        found = step
    }
    return found
}

export const neighbour = (steps: Array<Step>, code: string, dir: -1 | 1): Step | null => {
    const index = steps.findIndex((step) => step.code === code)
    const next = index + dir
    if (index === -1 || next < 0 || next >= steps.length) return null
    return steps[next]
}

export const segments = (steps: Array<Step>, totalMs: number): Array<{ code: string; widthPct: number }> =>
    steps.map((step) => ({
        code: step.code,
        widthPct: totalMs > 0 ? (step.durationMs * 100) / totalMs : 100 / steps.length,
    }))

export const stepState = (steps: Array<Step>, code: string, currentCode: string): StepState => {
    const index = steps.findIndex((step) => step.code === code)
    const current = steps.findIndex((step) => step.code === currentCode)
    if (index < current) return 'past'
    return index === current ? 'current' : 'upcoming'
}

export const formatTime = (ms: number): string => {
    const seconds = Math.max(0, Math.floor(ms / 1000))
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`
}
