import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { emptyBookmarks } from '../format/movie'
import { fixtureMovie } from '../test/fixtures'
import { NotFoundError, listLibrary, readMovie, resolveMediaPath, writeBookmarks } from './library.server'
import type { Bookmarks, Movie } from '../format/movie'

let root: string

const putMovie = async (dir: string, movie: Partial<Movie> = {}) => {
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'movie.json'), JSON.stringify({ ...fixtureMovie, ...movie }))
}

beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'chair lib '))
})
afterEach(async () => {
    await rm(root, { recursive: true, force: true })
})

describe('listLibrary', () => {
    it('a folder that is itself a movie', async () => {
        await putMovie(root)
        const { refs, problems } = await listLibrary(root)
        expect(problems).toEqual([])
        expect(refs).toHaveLength(1)
        expect(refs[0]).toMatchObject({
            id: basename(root),
            title: fixtureMovie.title,
            steps: fixtureMovie.steps.length,
            durationMs: fixtureMovie.durationMs,
        })
    })

    it('a folder of movies, newest first, with broken ones reported', async () => {
        await putMovie(join(root, 'old'), { createdAt: '2026-01-01T00:00:00.000Z' })
        await putMovie(join(root, 'new'), { createdAt: '2026-06-01T00:00:00.000Z' })
        await mkdir(join(root, 'broken'))
        await writeFile(join(root, 'broken', 'movie.json'), JSON.stringify({ ...fixtureMovie, version: 2 }))
        await mkdir(join(root, 'notamovie'))
        const { refs, problems } = await listLibrary(root)
        expect(refs.map((r) => r.id)).toEqual(['new', 'old'])
        expect(problems).toHaveLength(1)
        expect(problems[0]).toMatch(/^broken: movie\.json: version: /)
    })

    it('reports unparseable JSON', async () => {
        await mkdir(join(root, 'broken'))
        await writeFile(join(root, 'broken', 'movie.json'), '{nope')
        const { refs, problems } = await listLibrary(root)
        expect(refs).toEqual([])
        expect(problems[0]).toMatch(/^broken: movie\.json: /)
    })

    it('an empty folder', async () => {
        expect(await listLibrary(root)).toEqual({ refs: [], problems: [] })
    })
})

describe('readMovie', () => {
    it('returns empty bookmarks when the file is missing', async () => {
        await putMovie(join(root, 'a'))
        const { movie, bookmarks } = await readMovie(root, 'a')
        expect(movie.title).toBe(fixtureMovie.title)
        expect(bookmarks).toEqual(emptyBookmarks())
    })

    it('offers the captioned copy for download once it exists, the plain video before', async () => {
        await putMovie(join(root, 'a'))
        expect((await readMovie(root, 'a')).download).toBe('movie.mp4')
        await writeFile(join(root, 'a', 'movie-captioned.mp4'), 'x')
        expect((await readMovie(root, 'a')).download).toBe('movie-captioned.mp4')
    })

    it('unknown id is a NotFoundError', async () => {
        await expect(readMovie(root, 'nope')).rejects.toThrow('no movie nope')
        await expect(readMovie(root, 'nope')).rejects.toBeInstanceOf(NotFoundError)
    })

    it('names movie.json when it is not valid JSON', async () => {
        await mkdir(join(root, 'a'))
        await writeFile(join(root, 'a', 'movie.json'), '{ "version": 1, ')
        await expect(readMovie(root, 'a')).rejects.toThrow(/^movie\.json: \S/)
    })

    it('names movie.json and its first schema issue', async () => {
        await putMovie(join(root, 'a'), { version: 2 } as unknown as Partial<Movie>)
        await expect(readMovie(root, 'a')).rejects.toThrow(/^movie\.json: version: /)
    })

    it('names bookmarks.json when it is not valid JSON', async () => {
        await putMovie(join(root, 'a'))
        await writeFile(join(root, 'a', 'bookmarks.json'), '{nope')
        await expect(readMovie(root, 'a')).rejects.toThrow(/^bookmarks\.json: \S/)
    })

    it('names bookmarks.json and its first schema issue instead of a JSON dump', async () => {
        await putMovie(join(root, 'a'))
        const bad = { version: 1, items: [{ code: 'zz', createdAt: '2026-11-03T10:00:00.000Z' }] }
        await writeFile(join(root, 'a', 'bookmarks.json'), JSON.stringify(bad))
        await expect(readMovie(root, 'a')).rejects.toThrow(/^bookmarks\.json: items\.0\.code: Invalid string/)
    })

    it('reads a movie when root itself is the movie', async () => {
        await putMovie(root)
        const { movie } = await readMovie(root, basename(root))
        expect(movie.title).toBe(fixtureMovie.title)
    })
})

describe('writeBookmarks', () => {
    const good: Bookmarks = {
        version: 1,
        items: [{ code: '1a', note: 'check', createdAt: '2026-11-03T10:00:00.000Z' }],
    }

    it('round-trips', async () => {
        await putMovie(join(root, 'a'))
        await writeBookmarks(root, 'a', good)
        expect((await readMovie(root, 'a')).bookmarks).toEqual(good)
    })

    it('rejects an invalid payload and keeps the old file', async () => {
        await putMovie(join(root, 'a'))
        await writeBookmarks(root, 'a', good)
        await expect(writeBookmarks(root, 'a', { version: 2, items: [] } as unknown as Bookmarks)).rejects.toThrow()
        expect(JSON.parse(await readFile(join(root, 'a', 'bookmarks.json'), 'utf8'))).toEqual(good)
    })

    it('unknown id is a NotFoundError', async () => {
        await expect(writeBookmarks(root, 'nope', good)).rejects.toBeInstanceOf(NotFoundError)
    })
})

describe('resolveMediaPath', () => {
    it('resolves inside a folder with spaces', async () => {
        await putMovie(join(root, 'Movie One'))
        expect(resolveMediaPath(root, 'Movie One/movie.mp4')).toBe(join(root, 'Movie One', 'movie.mp4'))
    })

    it('resolves a file of a movie that is the root itself', async () => {
        await putMovie(root)
        expect(resolveMediaPath(root, `${basename(root)}/movie.mp4`)).toBe(join(root, 'movie.mp4'))
    })

    it('rejects traversal, absolute paths and bare ids', async () => {
        await putMovie(join(root, 'Movie One'))
        expect(() => resolveMediaPath(root, 'Movie One/../x')).toThrow(NotFoundError)
        expect(() => resolveMediaPath(root, 'C:/x')).toThrow(NotFoundError)
        expect(() => resolveMediaPath(root, '/etc/passwd')).toThrow(NotFoundError)
        expect(() => resolveMediaPath(root, 'Movie One')).toThrow(NotFoundError)
        expect(() => resolveMediaPath(root, 'Movie One\\..\\x')).toThrow(NotFoundError)
    })
})
