import { existsSync } from 'node:fs'
import { readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { CAPTIONED_VIDEO, bookmarksSchema, emptyBookmarks, movieSchema } from '../format/movie'
import type { ZodType } from 'zod'
import type { Bookmarks, Movie } from '../format/movie'

export class NotFoundError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'NotFoundError'
    }
}

export type MovieRef = {
    id: string
    title: string
    scope: string
    createdAt: string
    steps: number
    durationMs: number
}

const isPlainSegment = (segment: string): boolean =>
    segment.length > 0 && segment !== '.' && segment !== '..' && !/[\\/:]/.test(segment)

const movieDir = (root: string, id: string): string => {
    if (!isPlainSegment(id)) throw new NotFoundError(`no movie ${id}`)
    const rootDir = resolve(root)
    if (basename(rootDir) === id && existsSync(join(rootDir, 'movie.json'))) return rootDir
    const dir = join(rootDir, id)
    if (!existsSync(join(dir, 'movie.json'))) throw new NotFoundError(`no movie ${id}`)
    return dir
}

const parseFile = async <T>(dir: string, file: string, schema: ZodType<T>): Promise<T> => {
    let raw: unknown
    try {
        raw = JSON.parse(await readFile(join(dir, file), 'utf8'))
    } catch (error) {
        throw new Error(`${file}: ${(error as Error).message}`)
    }
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
        const issue = parsed.error.issues[0]
        const where = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
        throw new Error(`${file}: ${where}${issue.message}`)
    }
    return parsed.data
}

const parseMovie = (dir: string): Promise<Movie> => parseFile(dir, 'movie.json', movieSchema)

const toRef = (id: string, movie: Movie): MovieRef => ({
    id,
    title: movie.title,
    scope: movie.scope,
    createdAt: movie.createdAt,
    steps: movie.steps.length,
    durationMs: movie.durationMs,
})

export const listLibrary = async (root: string): Promise<{ refs: Array<MovieRef>; problems: Array<string> }> => {
    const rootDir = resolve(root)
    if (existsSync(join(rootDir, 'movie.json'))) {
        const id = basename(rootDir)
        try {
            return { refs: [toRef(id, await parseMovie(rootDir))], problems: [] }
        } catch (error) {
            return { refs: [], problems: [`${id}: ${(error as Error).message}`] }
        }
    }

    const refs: Array<MovieRef> = []
    const problems: Array<string> = []
    const entries = await readdir(rootDir, { withFileTypes: true })
    for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const dir = join(rootDir, entry.name)
        if (!existsSync(join(dir, 'movie.json'))) continue
        try {
            refs.push(toRef(entry.name, await parseMovie(dir)))
        } catch (error) {
            problems.push(`${entry.name}: ${(error as Error).message}`)
        }
    }
    refs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return { refs, problems }
}

export type LoadedMovie = { movie: Movie; bookmarks: Bookmarks; download?: string }

export const readMovie = async (root: string, id: string): Promise<LoadedMovie> => {
    const dir = movieDir(root, id)
    const movie = await parseMovie(dir)
    const download = existsSync(join(dir, CAPTIONED_VIDEO)) ? CAPTIONED_VIDEO : movie.video
    const bookmarks = existsSync(join(dir, 'bookmarks.json'))
        ? await parseFile(dir, 'bookmarks.json', bookmarksSchema)
        : emptyBookmarks()
    return { movie, bookmarks, download }
}

export const writeBookmarks = async (root: string, id: string, bookmarks: Bookmarks): Promise<void> => {
    const dir = movieDir(root, id)
    const valid = bookmarksSchema.parse(bookmarks)
    const path = join(dir, 'bookmarks.json')
    const temp = `${path}.tmp`
    await writeFile(temp, `${JSON.stringify(valid, null, 2)}\n`)
    await rename(temp, path)
}

export const resolveMediaPath = (root: string, splat: string): string => {
    const segments = splat.split(/[\\/]/)
    if (segments.length < 2 || !segments.every(isPlainSegment)) throw new NotFoundError(`no media ${splat}`)
    const [id, ...file] = segments
    return join(movieDir(root, id), ...file)
}
