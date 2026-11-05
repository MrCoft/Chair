import { describe, expect, it } from 'vitest'
import { fixtureMovie } from '../test/fixtures'
import { formatTime, neighbour, segments, stepAt, stepState } from './timeline'

const { steps } = fixtureMovie

describe('stepAt', () => {
    it('finds the step playing at a moment', () => {
        expect(stepAt(steps, 0).code).toBe('1')
        expect(stepAt(steps, 3999).code).toBe('1')
        expect(stepAt(steps, 4000).code).toBe('1a')
        expect(stepAt(steps, 12000).code).toBe('2f')
        expect(stepAt(steps, 19999).code).toBe('2f')
    })

    it('holds the last step past the end and the first before the start', () => {
        expect(stepAt(steps, 25000).code).toBe('2f')
        expect(stepAt(steps, -5).code).toBe('1')
    })
})

describe('neighbour', () => {
    it('steps forward and back in movie order', () => {
        expect(neighbour(steps, '1a', 1)?.code).toBe('2')
        expect(neighbour(steps, '2', -1)?.code).toBe('1a')
    })

    it('is null past either end or for an unknown code', () => {
        expect(neighbour(steps, '1', -1)).toBeNull()
        expect(neighbour(steps, '2f', 1)).toBeNull()
        expect(neighbour(steps, 'zz', 1)).toBeNull()
    })
})

describe('segments', () => {
    it('sizes each step by its share of the movie', () => {
        expect(segments(steps, 20000)).toEqual([
            { code: '1', widthPct: 20 },
            { code: '1a', widthPct: 25 },
            { code: '2', widthPct: 15 },
            { code: '2f', widthPct: 40 },
        ])
    })

    it('splits evenly when the movie has no length', () => {
        const instant = steps.map((step) => ({ ...step, startMs: 0, durationMs: 0 }))
        expect(segments(instant, 0).map((segment) => segment.widthPct)).toEqual([25, 25, 25, 25])
    })
})

describe('stepState', () => {
    it('marks steps before the current one past and after it upcoming', () => {
        expect(steps.map((step) => stepState(steps, step.code, '2'))).toEqual(['past', 'past', 'current', 'upcoming'])
    })
})

describe('formatTime', () => {
    it('shows minutes and seconds', () => {
        expect(formatTime(0)).toBe('00:00')
        expect(formatTime(20000)).toBe('00:20')
        expect(formatTime(65999)).toBe('01:05')
        expect(formatTime(3_600_000)).toBe('60:00')
    })
})
