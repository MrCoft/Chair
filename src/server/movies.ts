import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { bookmarksSchema } from '../format/movie'
import { listLibrary, readMovie, writeBookmarks } from './library.server'
import type { LoadedMovie, MovieRef } from './library.server'

const chairDir = (): string => {
    const dir = process.env.CHAIR_DIR
    if (!dir) throw new Error('CHAIR_DIR is not set — start the viewer with `chair view <dir>`')
    return dir
}

export const getLibrary = createServerFn({ method: 'GET' }).handler(
    async (): Promise<{ dir: string; refs: Array<MovieRef>; problems: Array<string> }> => {
        const dir = chairDir()
        return { dir, ...(await listLibrary(dir)) }
    },
)

export const getMovie = createServerFn({ method: 'GET' })
    .validator(z.object({ id: z.string() }))
    .handler(async ({ data }): Promise<LoadedMovie> => readMovie(chairDir(), data.id))

export const saveBookmarks = createServerFn({ method: 'POST' })
    .validator(z.object({ id: z.string(), bookmarks: bookmarksSchema }))
    .handler(async ({ data }): Promise<void> => writeBookmarks(chairDir(), data.id, data.bookmarks))
