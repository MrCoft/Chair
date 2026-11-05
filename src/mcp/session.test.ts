import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fixtureMovie } from '../test/fixtures'
import { ChairSession } from './session'
import type { Page } from 'playwright'
import type { MovieMeta } from '../recorder/assemble'
import type { SessionDeps } from './session'

const { spawnDetachedView } = vi.hoisted(() => ({ spawnDetachedView: vi.fn((): string | null => null) }))
vi.mock('../cli/spawn', () => ({ spawnDetachedView }))

const fakePage = {
    url: () => 'about:blank',
    viewportSize: () => ({ width: 1600, height: 900 }),
} as unknown as Page

function stubbedSession(overrides: Partial<SessionDeps> = {}) {
    const close = vi.fn(() => Promise.resolve())
    const launch = vi.fn(() => Promise.resolve({ page: fakePage, close }))
    const camera = {
        start: vi.fn(() => Promise.resolve()),
        stop: vi.fn(() => Promise.resolve()),
        flush: vi.fn(() => Promise.resolve()),
        snapshotFrame: vi.fn(() => Promise.resolve({ file: 'f.jpg', ts: Date.now() })),
    }
    const warn = vi.fn()
    const caption = vi.fn((dir: string) => Promise.resolve(resolve(dir, 'movie-captioned.mp4')))
    const filmed = { shouldKeep: (): boolean => false }
    const session = new ChairSession({
        launch,
        camera: (_page, _framesDir, _onFrame, shouldKeep) => {
            filmed.shouldKeep = shouldKeep
            return camera
        },
        caption,
        warn,
        ...overrides,
    })
    return { session, launch, close, camera, warn, caption, filmed }
}

const freshDir = (name: string) => {
    const dir = resolve('test-output', 'session', name)
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    return dir
}

const meta = (dir: string): MovieMeta => ({
    dir,
    id: 'unit',
    title: 'Unit',
    scope: 'session unit tests',
    parts: [{ code: '1', title: 'One' }],
})

const pack = (name: string) => resolve('test', 'fixtures', 'packs', name)

describe('ChairSession', () => {
    it('movieStart before open', async () => {
        await expect(new ChairSession().movieStart(meta(freshDir('before open')))).rejects.toThrow('call open first')
    })

    it('open fills in the defaults', async () => {
        const { session, launch } = stubbedSession()
        await session.open({ url: 'about:blank' })
        expect(launch).toHaveBeenCalledWith({
            url: 'about:blank',
            channel: 'chromium',
            viewport: { width: 1600, height: 900 },
            headless: true,
        })
        expect(session.status()).toEqual({ browser: true, movie: null, step: null, cut: false })
    })

    it('open with both a profile and a storage state', async () => {
        const { session, launch } = stubbedSession()
        await expect(session.open({ url: 'about:blank', userDataDir: 'p', storageState: 's.json' })).rejects.toThrow(
            'use either userDataDir or storageState, not both',
        )
        expect(launch).not.toHaveBeenCalled()
    })

    it('step before movieStart', async () => {
        const { session } = stubbedSession()
        await session.open({ url: 'about:blank' })
        expect(() => session.step('1', 'T', 'x')).toThrow('call movie_start first')
    })

    it('movieStart on a finished folder', async () => {
        const dir = freshDir("it's finished")
        writeFileSync(resolve(dir, 'movie.json'), '{}')
        const { session } = stubbedSession()
        await session.open({ url: 'about:blank' })
        await expect(session.movieStart(meta(dir))).rejects.toThrow(
            `movie folder already finished: ${dir} — movies are one-time, choose a new folder`,
        )
        expect(session.status().movie).toBeNull()
    })

    it('movieStart into a folder that is not empty', async () => {
        const withFile = freshDir("it's taken")
        writeFileSync(resolve(withFile, 'notes.txt'), 'mine')
        const withBareRaw = freshDir("it's raw")
        mkdirSync(resolve(withBareRaw, 'raw'))
        const { session } = stubbedSession()
        await session.open({ url: 'about:blank' })
        for (const dir of [withFile, withBareRaw]) {
            await expect(session.movieStart(meta(dir))).rejects.toThrow(
                `movie folder is not empty: ${dir} — choose a new folder`,
            )
        }
        expect(session.status().movie).toBeNull()
    })

    it('movieStart reuses a folder that holds only a leftover Chair raw/', async () => {
        const dir = freshDir("it's leftover")
        mkdirSync(resolve(dir, 'raw', 'frames'), { recursive: true })
        writeFileSync(resolve(dir, 'raw', 'frames', 'f000001.jpg'), '')
        const { session } = stubbedSession()
        await session.open({ url: 'about:blank' })
        await session.movieStart(meta(dir))
        expect(session.status().movie).toBe('unit')
    })

    it('movieStart with a part code the movie format rejects', async () => {
        const { session } = stubbedSession()
        await session.open({ url: 'about:blank' })
        const bad = { ...meta(freshDir('bad part')), parts: [{ code: 'A', title: 'Letters' }] }
        await expect(session.movieStart(bad)).rejects.toThrow(/invalid movie:[\s\S]*parts\[0\]\.code/)
        expect(session.status().movie).toBeNull()
    })

    it('run with code that is not a function', async () => {
        const { session } = stubbedSession()
        await session.open({ url: 'about:blank' })
        for (const code of ['42', 'page.click()', 'async (page, h) => {']) {
            await expect(session.run(code)).rejects.toThrow(
                'code must be a function expression like async (page, h) => { … }',
            )
        }
    })

    it('run gets the built-in helpers and the helper pack', async () => {
        const { session } = stubbedSession()
        await session.open({ url: 'about:blank', helpers: pack('twice.mjs') })
        await expect(session.run('async (page, h) => [typeof h.click, typeof h.twice, page.url()];')).resolves.toEqual([
            'function',
            'function',
            'about:blank',
        ])
    })

    it('open loads the helper pack afresh each time', async () => {
        const file = resolve(freshDir("it's a pack"), 'pack.mjs')
        writeFileSync(file, 'export default () => ({ first: () => 1 })')
        const { session } = stubbedSession()
        await session.open({ url: 'about:blank', helpers: file })
        await session.close()
        writeFileSync(file, 'export default () => ({ second: () => 2 })')
        await session.open({ url: 'about:blank', helpers: file })
        await expect(session.run('async (page, h) => [typeof h.first, typeof h.second]')).resolves.toEqual([
            'undefined',
            'function',
        ])
    })

    it('a helper pack that overrides a built-in', async () => {
        const { session, close } = stubbedSession()
        await expect(session.open({ url: 'about:blank', helpers: pack('override-click.mjs') })).rejects.toThrow(
            'helper pack overrides built-in h.click',
        )
        expect(close).toHaveBeenCalled()
        expect(session.status().browser).toBe(false)
    })

    it('movieStart names the movie after its folder when no id is given', async () => {
        const { session } = stubbedSession()
        await session.open({ url: 'about:blank' })
        const dir = freshDir("it's named")
        await expect(session.movieStart({ ...meta(dir), id: undefined })).resolves.toMatchObject({
            id: "it's named",
            dir,
        })
        expect(session.status().movie).toBe("it's named")
    })

    it('close while a movie is recording', async () => {
        const { session, close, camera } = stubbedSession()
        await session.open({ url: 'about:blank' })
        await session.movieStart(meta(freshDir("it's unfinished")))
        await expect(session.close()).rejects.toThrow(
            'a movie is still recording — call finish, or close({ discard: true }) to throw it away',
        )
        expect(session.status()).toMatchObject({ browser: true, movie: 'unit' })
        expect(camera.stop).not.toHaveBeenCalled()
        expect(close).not.toHaveBeenCalled()
    })

    it('close with discard throws the unfinished movie and its frames away', async () => {
        const { session, close, camera } = stubbedSession()
        await session.open({ url: 'about:blank' })
        const dir = freshDir("it's discarded")
        await session.movieStart(meta(dir))
        writeFileSync(resolve(dir, 'raw', 'frames', 'f000001.jpg'), '')
        await expect(session.close({ discard: true })).resolves.toBe('unit')
        expect(camera.stop).toHaveBeenCalled()
        expect(close).toHaveBeenCalled()
        expect(existsSync(resolve(dir, 'raw'))).toBe(false)
        expect(session.status()).toEqual({ browser: false, movie: null, step: null, cut: false })
    })

    it('close without a movie closes the browser', async () => {
        const { session, close } = stubbedSession()
        await session.open({ url: 'about:blank' })
        await expect(session.close()).resolves.toBeNull()
        expect(close).toHaveBeenCalled()
        expect(session.status().browser).toBe(false)
    })

    it('finish with nothing filmed', async () => {
        const { session } = stubbedSession()
        await session.open({ url: 'about:blank' })
        await session.movieStart(meta(freshDir("it's empty")))
        await expect(session.finish({ open: false })).rejects.toThrow('nothing was filmed — record at least one step')
        expect(session.status().movie).toBe('unit')
    })
})

describe('ChairSession filming', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] })
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    async function recording(name: string, overrides: Partial<SessionDeps>) {
        const stub = stubbedSession(overrides)
        const dir = freshDir(name)
        await stub.session.open({ url: 'about:blank' })
        await stub.session.movieStart(meta(dir))
        stub.session.step('1', 'Count', 'Press Add.')
        await stub.session.run('async () => 0')
        return { ...stub, dir }
    }

    it('step films nothing by itself, so the action starts straight away', async () => {
        const finish = vi.fn<SessionDeps['finish']>(() => Promise.resolve(fixtureMovie))
        const { session, camera } = await recording("it's immediate", { finish })
        session.step('1a', 'Again', 'Press Add again.')
        expect(camera.snapshotFrame).toHaveBeenCalledTimes(1)
        await session.run('async () => 1')
        await session.finish({ open: false })
        const [, step] = finish.mock.calls[0][0].steps
        expect(step.segments).toHaveLength(1)
    })

    it('retake throws the footage away and films nothing until the next run', async () => {
        const finish = vi.fn<SessionDeps['finish']>(() => Promise.resolve(fixtureMovie))
        const { session, camera } = await recording("it's retaken", { finish })
        session.retake()
        expect(camera.snapshotFrame).toHaveBeenCalledTimes(1)
        await session.run('async () => 2')
        await session.finish({ open: false })
        const [step] = finish.mock.calls[0][0].steps
        expect(step.segments).toHaveLength(1)
    })

    it('the camera keeps frames only while a call is filmed', async () => {
        const { session, camera, filmed } = await recording("it's kept", {})
        const kept: Array<boolean> = []
        camera.snapshotFrame.mockImplementation(() => {
            kept.push(filmed.shouldKeep())
            return Promise.resolve({ file: 'f.jpg', ts: Date.now() })
        })
        expect(filmed.shouldKeep()).toBe(false)
        await session.run('async () => 1')
        expect(kept).toEqual([true])
        expect(filmed.shouldKeep()).toBe(false)
        session.cut()
        await session.run('async () => 1')
        expect(kept).toEqual([true])
        expect(filmed.shouldKeep()).toBe(false)
    })

    it('finish makes the captioned copy for downloads', async () => {
        const finish = vi.fn<SessionDeps['finish']>(() => Promise.resolve(fixtureMovie))
        const { session, caption, warn, dir } = await recording("it's captioned", { finish })
        await session.finish({ open: false })
        expect(caption).toHaveBeenCalledExactlyOnceWith(dir)
        expect(warn).not.toHaveBeenCalled()
    })

    it('a failed captioned copy only warns, and says how to make it later', async () => {
        const finish = vi.fn<SessionDeps['finish']>(() => Promise.resolve(fixtureMovie))
        const caption = vi.fn(() => Promise.reject(new Error('chromium is not installed')))
        const { session, warn, dir } = await recording("it's uncaptioned", { finish, caption })
        await expect(session.finish({ open: false })).resolves.toEqual(fixtureMovie)
        expect(warn).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('chromium is not installed'))
        expect(warn).toHaveBeenCalledWith(expect.stringContaining(`chair export "${dir}"`))
    })

    it('finish passes on why the viewer could not open', async () => {
        const problem = 'viewer not built — run pnpm build in C:\\Chair, then chair view "C:\\movies"'
        spawnDetachedView.mockReturnValueOnce(problem)
        const finish = vi.fn<SessionDeps['finish']>(() => Promise.resolve(fixtureMovie))
        const { session, warn, dir } = await recording("it's unviewed", { finish })
        await session.finish({})
        expect(spawnDetachedView).toHaveBeenCalledWith(dir)
        expect(warn).toHaveBeenCalledWith(problem)
    })

    it('a failed finish keeps the movie recording', async () => {
        const finish = vi
            .fn<SessionDeps['finish']>()
            .mockRejectedValueOnce(new Error('ffmpeg exited with code 1'))
            .mockResolvedValueOnce(fixtureMovie)
        const { session, camera } = await recording("it's failing", { finish })
        await expect(session.finish({ open: false })).rejects.toThrow('ffmpeg exited with code 1')
        expect(session.status()).toMatchObject({ movie: 'unit', step: '1' })
        expect(camera.stop).toHaveBeenCalledTimes(1)
        expect(camera.start).toHaveBeenCalledTimes(2)

        await session.run('async () => 1')
        expect(camera.snapshotFrame).toHaveBeenCalledTimes(2)
        await expect(session.finish({ open: false })).resolves.toEqual(fixtureMovie)
        expect(session.status().movie).toBeNull()
    })

    it('a finish whose raw/ cleanup fails still finishes the movie', async () => {
        const finish = vi.fn<SessionDeps['finish']>(({ meta: m }) => {
            writeFileSync(resolve(m.dir, 'movie.json'), JSON.stringify(fixtureMovie))
            return Promise.reject(new Error('EBUSY: resource busy or locked'))
        })
        const { session, camera, warn, dir } = await recording("it's locked", { finish })
        await expect(session.finish({ open: false })).resolves.toEqual(fixtureMovie)
        expect(warn).toHaveBeenCalledWith(expect.stringContaining(resolve(dir, 'raw')))
        expect(camera.start).toHaveBeenCalledTimes(1)
        expect(session.status().movie).toBeNull()
        expect(() => session.step('1a', 'T', 'x')).toThrow('call movie_start first')
    })
})
