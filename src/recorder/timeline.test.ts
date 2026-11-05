import { describe, expect, it } from 'vitest'
import { Timeline } from './timeline'

const parts = [
    { code: '1', title: 'One' },
    { code: '2', title: 'Two' },
]

const film = (t: Timeline, start: number, end: number) => {
    t.openSegment(start)
    t.addFrame({ file: `f${start}.jpg`, ts: start + 1 })
    t.closeSegment(end)
}

describe('Timeline', () => {
    it('ignores frames outside an open segment', () => {
        const t = new Timeline(parts)
        t.startStep('1', 'T', 'x')
        t.addFrame({ file: 'a', ts: 5 })
        t.openSegment(10)
        t.addFrame({ file: 'b', ts: 12 })
        t.closeSegment(20)
        t.addFrame({ file: 'c', ts: 25 })
        expect(t.keptSteps()[0].segments).toEqual([{ startMs: 10, endMs: 20, frames: [{ file: 'b', ts: 12 }] }])
    })

    it('is filming only while a segment is open', () => {
        const t = new Timeline(parts)
        expect(t.isFilming).toBe(false)
        t.startStep('1', 'T', 'x')
        expect(t.isFilming).toBe(false)
        t.openSegment(10)
        expect(t.isFilming).toBe(true)
        t.closeSegment(20)
        expect(t.isFilming).toBe(false)
        t.cut()
        t.openSegment(30)
        expect(t.isFilming).toBe(false)
    })

    it('does not film while cut', () => {
        const t = new Timeline(parts)
        t.startStep('1', 'T', 'x')
        t.cut()
        expect(t.isCut).toBe(true)
        expect(t.openSegment(30)).toBe(false)
        t.resume()
        expect(t.openSegment(30)).toBe(true)
    })

    it("retake drops the step's footage and actions and makes it current", () => {
        const t = new Timeline(parts)
        t.startStep('1', 'A', 'x')
        t.openSegment(0)
        t.logAction('click', 'btn', 1)
        t.closeSegment(2)
        t.startStep('1a', 'B', 'y')
        film(t, 10, 20)
        t.retake('1')
        expect(t.currentCode).toBe('1')
        expect(t.keptSteps().map((s) => s.code)).toEqual(['1a'])
        t.openSegment(30)
        t.logAction('type', 'field', 31)
        t.closeSegment(40)
        const kept = t.keptSteps()
        expect(kept.map((s) => s.code)).toEqual(['1', '1a'])
        expect(kept[0].actions).toEqual([{ kind: 'type', target: 'field', ts: 31 }])
        expect(kept[0].segments).toHaveLength(1)
        expect(kept[1].segments).toHaveLength(1)
    })

    it('retake clears the cut flag so the redo is filmed', () => {
        const t = new Timeline(parts)
        t.startStep('1', 'A', 'x')
        film(t, 0, 5)
        t.cut()
        t.retake()
        expect(t.isCut).toBe(false)
        expect(t.openSegment(10)).toBe(true)
    })

    it('startStep clears the cut flag', () => {
        const t = new Timeline(parts)
        t.startStep('1', 'A', 'x')
        t.cut()
        t.startStep('1a', 'B', 'y')
        expect(t.isCut).toBe(false)
        expect(t.openSegment(10)).toBe(true)
    })

    it('a throwing startStep or retake leaves the cut flag alone', () => {
        const t = new Timeline(parts)
        t.startStep('1', 'A', 'x')
        t.cut()
        expect(() => t.startStep('1', 'A', 'x')).toThrow()
        expect(() => t.retake('9z')).toThrow()
        expect(t.isCut).toBe(true)
    })

    it('retake() without a code retakes the current step', () => {
        const t = new Timeline(parts)
        t.startStep('1', 'A', 'x')
        film(t, 0, 5)
        t.retake()
        expect(t.currentCode).toBe('1')
        expect(t.keptSteps()).toEqual([])
    })

    it('startStep with a used code throws', () => {
        const t = new Timeline(parts)
        t.startStep('1a', 'A', 'x')
        expect(() => t.startStep('1a', 'A', 'x')).toThrow("step 1a already exists — use retake('1a')")
    })

    it('startStep with an unknown part throws', () => {
        expect(() => new Timeline(parts).startStep('7', 'A', 'x')).toThrow('unknown part 7')
    })

    it('startStep with a malformed code throws', () => {
        expect(() => new Timeline(parts).startStep('2F', 'A', 'x')).toThrow('invalid step code 2F')
    })

    it('cut, retake, openSegment without a step throw', () => {
        const t = new Timeline(parts)
        expect(() => t.cut()).toThrow('no step started — call step first')
        expect(() => t.retake()).toThrow('no step started — call step first')
        expect(() => t.openSegment(1)).toThrow('no step started — call step first')
    })

    it('retake of an unknown code throws', () => {
        const t = new Timeline(parts)
        t.startStep('1', 'A', 'x')
        expect(() => t.retake('9z')).toThrow('no step 9z to retake')
    })

    it('openSegment while one is open throws', () => {
        const t = new Timeline(parts)
        t.startStep('1', 'A', 'x')
        t.openSegment(1)
        expect(() => t.openSegment(2)).toThrow('segment already open')
        expect(() => t.startStep('1a', 'A', 'x')).toThrow('segment already open')
        expect(() => t.cut()).toThrow('segment already open')
        expect(() => t.retake()).toThrow('segment already open')
    })

    it('keptSteps omits steps with no segments', () => {
        const t = new Timeline(parts)
        t.startStep('1', 'A', 'x')
        t.startStep('1a', 'B', 'y')
        film(t, 0, 5)
        expect(t.keptSteps().map((s) => s.code)).toEqual(['1a'])
    })

    it('logAction only keeps actions inside an open segment', () => {
        const t = new Timeline(parts)
        t.startStep('1', 'A', 'x')
        t.cut()
        t.logAction('click', 'a', 1)
        t.resume()
        t.logAction('click', 'b', 2)
        t.openSegment(3)
        t.logAction('click', undefined, 4)
        t.closeSegment(5)
        expect(t.keptSteps()[0].actions).toEqual([{ kind: 'click', target: undefined, ts: 4 }])
    })
})
