import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import type { Action } from '../format/movie'
import type { Frame, StepDraft } from './timeline'

export type Layout = {
    concat: string
    totalMs: number
    steps: Array<{ code: string; startMs: number; durationMs: number; actions: Array<Action> }>
}

export function concatPath(file: string): string {
    return file.replaceAll('\\', '/').replaceAll("'", "'\\''")
}

export function pickFfmpeg(staticPath: string | null): string {
    return staticPath !== null && existsSync(staticPath) ? staticPath : 'ffmpeg'
}

export function defaultFfmpeg(): string {
    return pickFfmpeg(createRequire(import.meta.url)('ffmpeg-static') as string | null)
}

const seconds = (ms: number) => (ms / 1000).toFixed(3)

export function layoutFrames(steps: Array<StepDraft>): Layout {
    const lines: Array<string> = []
    let lastFile = ''
    let totalMs = 0
    const laidOut: Layout['steps'] = []

    for (const step of steps) {
        const startMs = totalMs
        let stepMs = 0
        const actions: Array<Action> = []

        for (const segment of step.segments) {
            const frames = [...segment.frames].sort((a, b) => a.ts - b.ts)
            const segStart = Math.round(segment.startMs)
            const segEnd = Math.round(segment.endMs)
            const length = segEnd - segStart
            if (frames.length === 0 || length <= 0) continue

            const clamp = (ts: number) => Math.min(Math.max(Math.round(ts), segStart), segEnd)
            frames.forEach((frame, index) => {
                const from = index === 0 ? segStart : clamp(frame.ts)
                const next = frames[index + 1] as Frame | undefined
                const to = next ? clamp(next.ts) : segEnd
                if (to <= from) return
                lines.push(`file '${concatPath(frame.file)}'`, `duration ${seconds(to - from)}`)
                lastFile = frame.file
            })

            for (const action of step.actions) {
                if (action.ts < segment.startMs || action.ts > segment.endMs) continue
                const mapped: Action = { kind: action.kind, atMs: stepMs + (Math.round(action.ts) - segStart) }
                if (action.target !== undefined) mapped.target = action.target
                actions.push(mapped)
            }
            stepMs += length
        }

        totalMs += stepMs
        laidOut.push({ code: step.code, startMs, durationMs: stepMs, actions })
    }

    if (lastFile) lines.push(`file '${concatPath(lastFile)}'`)
    return { concat: lines.length ? lines.join('\n') + '\n' : '', totalMs, steps: laidOut }
}

const tail = (text: string) => text.trimEnd().split('\n').slice(-20).join('\n')

export function runFfmpeg(ffmpegPath: string, args: Array<string>, allowFailure = false): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(ffmpegPath, args, { windowsHide: true })
        let stderr = ''
        child.stderr.on('data', (chunk) => (stderr += chunk))
        child.on('error', reject)
        child.on('close', (code) => {
            if (code === 0 || allowFailure) resolve(stderr)
            else reject(new Error(`ffmpeg exited with code ${code}\n${tail(stderr)}`))
        })
    })
}

export async function encodeMovie(concatFile: string, outFile: string, ffmpegPath = defaultFfmpeg()): Promise<void> {
    await runFfmpeg(ffmpegPath, [
        '-y',
        '-nostdin',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        concatFile,
        '-vf',
        'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p,fps=30',
        '-c:v',
        'libx264',
        '-g',
        '30',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-movflags',
        '+faststart',
        outFile,
    ])
}

export async function mediaDurationMs(file: string, ffmpegPath = defaultFfmpeg()): Promise<number> {
    const stderr = await runFfmpeg(ffmpegPath, ['-i', file], true)
    const match = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr)
    if (!match) throw new Error(`could not read duration of ${file}\n${tail(stderr)}`)
    return Math.round((Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])) * 1000)
}
