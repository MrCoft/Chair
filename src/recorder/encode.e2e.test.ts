import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { defaultFfmpeg, encodeMovie, layoutFrames, mediaDurationMs } from './encode'

it('encodes a laid-out segment into an mp4 of the right length', async () => {
    const dir = resolve('test-output', 'encode', "it's here")
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    const files = ['red', 'blue'].map((color) => {
        const file = resolve(dir, `${color}.jpg`)
        const result = spawnSync(
            defaultFfmpeg(),
            ['-y', '-f', 'lavfi', '-i', `color=${color}:s=320x180`, '-frames:v', '1', file],
            { encoding: 'utf8' },
        )
        expect(result.status, result.stderr).toBe(0)
        return file
    })
    const layout = layoutFrames([
        {
            code: 'A',
            title: '',
            text: '',
            segments: [
                {
                    startMs: 0,
                    endMs: 1500,
                    frames: [
                        { file: files[0], ts: 0 },
                        { file: files[1], ts: 700 },
                    ],
                },
            ],
            actions: [],
        },
    ])
    const list = resolve(dir, 'frames.txt')
    writeFileSync(list, layout.concat)
    const out = resolve(dir, 'out.mp4')
    await encodeMovie(list, out)
    expect(Math.abs((await mediaDurationMs(out)) - 1500)).toBeLessThanOrEqual(100)
})
