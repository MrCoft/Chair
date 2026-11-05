import { describe, expect, it } from 'vitest'
import { fixtureMovie } from '../test/fixtures'
import { bookmarksSchema, emptyBookmarks, movieSchema, partOf } from './movie'

const withSteps = (steps: Array<unknown>) => ({ ...fixtureMovie, steps })
const messageOf = (input: unknown): string => {
    const result = movieSchema.safeParse(input)
    if (result.success) throw new Error('expected parse to fail')
    return result.error.issues.map((i) => i.message).join('\n')
}

describe('movieSchema', () => {
    it('parses a valid movie', () => {
        expect(movieSchema.parse(fixtureMovie)).toEqual(fixtureMovie)
    })

    it('rejects a duplicate step code', () => {
        const steps = [...fixtureMovie.steps, { ...fixtureMovie.steps[3], startMs: 20000 }]
        expect(messageOf({ ...fixtureMovie, durationMs: 28000, steps })).toContain('duplicate step code 2f')
    })

    it('rejects a step whose part does not match its code', () => {
        const steps = fixtureMovie.steps.map((s) => (s.code === '2f' ? { ...s, part: '1' } : s))
        expect(messageOf(withSteps(steps))).toContain('step 2f belongs to part 2')
    })

    it('rejects a step of an unknown part', () => {
        const steps = [...fixtureMovie.steps, { ...fixtureMovie.steps[3], code: '3a', part: '3', startMs: 20000 }]
        expect(messageOf({ ...fixtureMovie, durationMs: 28000, steps })).toContain('unknown part 3')
    })

    it.each(['2F', '0a', '2ab', ''])('rejects malformed code %j', (code) => {
        const steps = fixtureMovie.steps.map((s) => (s.code === '2f' ? { ...s, code } : s))
        expect(movieSchema.safeParse(withSteps(steps)).success).toBe(false)
    })

    it('rejects steps that are not contiguous', () => {
        const steps = fixtureMovie.steps.map((s) => (s.code === '1a' ? { ...s, startMs: 4100 } : s))
        expect(messageOf(withSteps(steps))).toContain('step 1a must start at 4000')
    })
})

describe('partOf', () => {
    it('extracts the part number', () => {
        expect(partOf('2f')).toBe('2')
        expect(partOf('12')).toBe('12')
        expect(partOf('3')).toBe('3')
    })
})

describe('bookmarksSchema', () => {
    it('parses empty bookmarks', () => {
        expect(bookmarksSchema.parse(emptyBookmarks())).toEqual({ version: 1, items: [] })
    })
})
