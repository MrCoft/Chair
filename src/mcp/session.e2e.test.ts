import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it } from 'vitest'
import { movieSchema } from '../format/movie'
import { defaultFfmpeg, mediaDurationMs } from '../recorder/encode'
import { ChairSession } from './session'
import type { Movie } from '../format/movie'

const fixture = (name: string) => pathToFileURL(resolve('test', 'fixtures', 'site', name)).href
const pacing = { markMs: 80, cursorMs: 200, typeDelayMs: 40, afterMs: 20 }
const clickAdd = `async (page, h) => { await h.click(page.getByRole('button', { name: 'Add' })) }`
const typeName = `async (page, h) => { await h.type(page.getByLabel('Name'), 'Ada') }`
const kinds = (movie: Movie, code: string) =>
    movie.steps.find((step) => step.code === code)?.actions.map((action) => action.kind)

let session: ChairSession | undefined

afterEach(async () => {
    await session?.close({ discard: true })
    session = undefined
})

async function startMovie(name: string): Promise<{ s: ChairSession; dir: string }> {
    const dir = resolve('test-output', 'movies', name)
    rmSync(dir, { recursive: true, force: true })
    const s = new ChairSession()
    session = s
    await s.open({ url: fixture('index.html'), pacing })
    await s.movieStart({
        dir,
        id: 'session-e2e',
        title: "It's a movie",
        scope: 'session e2e',
        parts: [
            { code: '1', title: 'Intro' },
            { code: '2', title: 'Navigation' },
        ],
    })
    return { s, dir }
}

it('records a movie with cut and retake', async () => {
    const { s, dir } = await startMovie("it's a movie")

    s.step('1', 'Count', 'Press **Add** once.')
    await s.run(clickAdd)
    s.step('1a', 'Name', 'Type a name.')
    await s.run(typeName)
    s.cut()
    await s.run(clickAdd)
    s.resume()
    await s.run(clickAdd)
    s.retake('1a')
    await s.run(typeName)

    s.step('2', 'Second page', 'Go to the second page and come back.')
    const framesDir = resolve(dir, 'raw', 'frames')
    const framesBeforeCut = readdirSync(framesDir).length
    s.cut()
    await s.run(clickAdd)
    expect(readdirSync(framesDir).length).toBe(framesBeforeCut)
    s.resume()
    const framesBefore = readdirSync(framesDir).length
    const seen = await s.run(`async (page, h) => {
        await h.goto(${JSON.stringify(fixture('second.html'))})
        const cursorOnSecond = await page.locator('#__chair_cursor').count()
        await h.click(page.getByRole('button', { name: 'Back' }))
        await page.waitForURL(/index\\.html/)
        return { cursorOnSecond, cursorBack: await page.locator('#__chair_cursor').count() }
    }`)
    expect(seen).toEqual({ cursorOnSecond: 1, cursorBack: 1 })
    expect(readdirSync(framesDir).length - framesBefore).toBeGreaterThan(5)

    const movie = await s.finish({ open: false })

    expect(movie.steps.map((step) => step.code)).toEqual(['1', '1a', '2'])
    expect(kinds(movie, '1')).toEqual(['click'])
    expect(kinds(movie, '1a')).toEqual(['type'])
    expect(kinds(movie, '2')).toEqual(['goto', 'click'])
    expect(movie.steps[2].actions.some((action) => action.target?.includes("'Add'"))).toBe(false)
    expect(Math.abs((await mediaDurationMs(resolve(dir, 'movie.mp4'))) - movie.durationMs)).toBeLessThanOrEqual(300)
    expect(movieSchema.parse(JSON.parse(readFileSync(resolve(dir, 'movie.json'), 'utf8')))).toEqual(movie)
    expect(existsSync(resolve(dir, 'raw'))).toBe(false)
    expect(JSON.parse(readFileSync(resolve(dir, 'bookmarks.json'), 'utf8'))).toEqual({ version: 1, items: [] })
    expect(s.status()).toEqual({ browser: true, movie: null, step: null, cut: false })

    const captioned = resolve(dir, 'movie-captioned.mp4')
    expect(Math.abs((await mediaDurationMs(captioned)) - movie.durationMs)).toBeLessThanOrEqual(300)
    const midFirstStep = (movie.steps[0].startMs + movie.steps[0].durationMs / 2) / 1000
    const [plainRed] = pixel(resolve(dir, 'movie.mp4'), midFirstStep, 60, 840)
    const [boxRed, boxGreen, boxBlue] = pixel(captioned, midFirstStep, 60, 840)
    expect(plainRed).toBeGreaterThan(200)
    expect(boxRed + boxGreen + boxBlue).toBeLessThan(250)
    expect(readdirSync(dir).sort()).toEqual(['bookmarks.json', 'movie-captioned.mp4', 'movie.json', 'movie.mp4'])
})

function pixel(file: string, seconds: number, x: number, y: number): Array<number> {
    const args = ['-v', 'error', '-ss', seconds.toFixed(3), '-i', file, '-frames:v', '1']
    const out = spawnSync(defaultFfmpeg(), [
        ...args,
        '-vf',
        `format=rgb24,crop=2:2:${x}:${y}`,
        '-f',
        'rawvideo',
        '-pix_fmt',
        'rgb24',
        '-',
    ])
    return [...out.stdout].slice(0, 3)
}

it('an error inside a filmed run', async () => {
    const { s } = await startMovie("it's an error")

    s.step('1', 'Oops', 'Something breaks.')
    await expect(s.run(`async (page, h) => { throw new Error('boom') }`)).rejects.toThrow('boom')
    expect(s.status().step).toBe('1')
    await s.run(clickAdd)

    const movie = await s.finish({ open: false })
    expect(kinds(movie, '1')).toEqual(['click'])
})
