import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { concatPath, layoutFrames, pickFfmpeg } from './encode'
import type { StepDraft } from './timeline'

const stepA: StepDraft = {
    code: 'A',
    title: 'a',
    text: '',
    segments: [
        {
            startMs: 0,
            endMs: 1000,
            frames: [
                { file: 'f2.jpg', ts: 400 },
                { file: 'f1.jpg', ts: 0 },
            ],
        },
    ],
    actions: [],
}
const stepB: StepDraft = {
    code: 'B',
    title: 'b',
    text: '',
    segments: [{ startMs: 5000, endMs: 5500, frames: [{ file: 'f3.jpg', ts: 5100 }] }],
    actions: [
        { kind: 'click', target: 'x', ts: 5200 },
        { kind: 'type', ts: 3000 },
    ],
}

describe('layoutFrames', () => {
    it('computes frame durations and step spans', () => {
        const layout = layoutFrames([stepA, stepB])
        expect(layout.concat).toContain("file 'f1.jpg'\nduration 0.400\n")
        expect(layout.concat).toContain("file 'f2.jpg'\nduration 0.600\n")
        expect(layout.concat).toContain("file 'f3.jpg'\nduration 0.500\n")
        expect(layout.steps.map(({ code, startMs, durationMs }) => ({ code, startMs, durationMs }))).toEqual([
            { code: 'A', startMs: 0, durationMs: 1000 },
            { code: 'B', startMs: 1000, durationMs: 500 },
        ])
        expect(layout.totalMs).toBe(1500)
    })

    it('repeats the last file line at the end', () => {
        const lines = layoutFrames([stepA, stepB]).concat.trimEnd().split('\n')
        expect(lines.at(-1)).toBe("file 'f3.jpg'")
        expect(lines.at(-2)).toBe('duration 0.500')
    })

    it('maps actions into the movie and drops those outside segments', () => {
        const [, b] = layoutFrames([stepA, stepB]).steps
        expect(b.actions).toEqual([{ kind: 'click', target: 'x', atMs: 200 }])
        const untargeted = layoutFrames([{ ...stepB, actions: [{ kind: 'type', ts: 5300 }] }]).steps[0].actions[0]
        expect('target' in untargeted).toBe(false)
    })

    it('offsets actions by earlier kept footage within a step', () => {
        const step: StepDraft = {
            code: 'C',
            title: '',
            text: '',
            segments: [
                { startMs: 0, endMs: 300, frames: [{ file: 'a.jpg', ts: 0 }] },
                { startMs: 1000, endMs: 1400, frames: [{ file: 'b.jpg', ts: 1000 }] },
            ],
            actions: [{ kind: 'click', ts: 1100 }],
        }
        expect(layoutFrames([step]).steps[0].actions).toEqual([{ kind: 'click', atMs: 400 }])
    })

    it('produces whole milliseconds that chain exactly from fractional timestamps', () => {
        const a: StepDraft = {
            code: 'A',
            title: '',
            text: '',
            segments: [
                {
                    startMs: 1000.4,
                    endMs: 1999.6,
                    frames: [
                        { file: 'a.jpg', ts: 1000.4 },
                        { file: 'b.jpg', ts: 1333.3 },
                    ],
                },
            ],
            actions: [{ kind: 'click', ts: 1500.5 }],
        }
        const b: StepDraft = {
            code: 'B',
            title: '',
            text: '',
            segments: [{ startMs: 3000.7, endMs: 3400.2, frames: [{ file: 'c.jpg', ts: 3000.7 }] }],
            actions: [{ kind: 'click', ts: 3100.5 }],
        }
        const layout = layoutFrames([a, b])
        const numbers = [
            layout.totalMs,
            ...layout.steps.flatMap((s) => [s.startMs, s.durationMs, ...s.actions.map((x) => x.atMs)]),
        ]
        expect(numbers.every(Number.isInteger)).toBe(true)
        expect(layout.steps[0].startMs + layout.steps[0].durationMs).toBe(layout.steps[1].startMs)
        expect(layout.steps[1].startMs + layout.steps[1].durationMs).toBe(layout.totalMs)
        expect(layout.concat).toContain("file 'a.jpg'\nduration 0.333\n")
        expect(layout.concat).toContain("file 'b.jpg'\nduration 0.667\n")
    })

    it('gives a frameless segment no time', () => {
        const step: StepDraft = {
            code: 'D',
            title: '',
            text: '',
            segments: [
                { startMs: 0, endMs: 700, frames: [] },
                { startMs: 1000, endMs: 1200, frames: [{ file: 'a.jpg', ts: 1000 }] },
            ],
            actions: [{ kind: 'click', ts: 100 }],
        }
        const layout = layoutFrames([step])
        expect(layout.totalMs).toBe(200)
        expect(layout.steps[0].actions).toEqual([])
    })
})

describe('concatPath', () => {
    it('uses forward slashes and escapes single quotes', () => {
        expect(concatPath("C:\\a b\\it's\\f1.jpg")).toBe("C:/a b/it'\\''s/f1.jpg")
    })
})

describe('pickFfmpeg', () => {
    it('uses the ffmpeg-static binary when it is on disk', () => {
        const dir = resolve('test-output', 'encode', "it's static")
        mkdirSync(dir, { recursive: true })
        const binary = resolve(dir, 'ffmpeg.exe')
        writeFileSync(binary, '')
        expect(pickFfmpeg(binary)).toBe(binary)
    })

    it('falls back to ffmpeg on PATH when ffmpeg-static has no binary', () => {
        expect(pickFfmpeg(null)).toBe('ffmpeg')
        expect(pickFfmpeg(resolve('test-output', 'encode', 'never downloaded', 'ffmpeg.exe'))).toBe('ffmpeg')
    })
})
