import { vi } from 'vitest'
import { fixtureBookmarks, fixtureMovie, fixtureRef } from '../fixtures'
import type * as RealMovies from '../../server/movies'
import type { Bookmarks } from '../../format/movie'

type Returns<TFn> = TFn extends (...args: Array<never>) => Promise<infer R> ? R : never

export const getLibrary = vi.fn((): Promise<Returns<typeof RealMovies.getLibrary>> =>
    Promise.resolve({ dir: 'C:\\movies', refs: [fixtureRef], problems: [] }),
)

export const getMovie = vi.fn(({ data }: { data: { id: string } }): Promise<Returns<typeof RealMovies.getMovie>> => {
    if (data.id !== fixtureMovie.id) return Promise.reject(new Error(`no movie ${data.id}`))
    return Promise.resolve({ movie: fixtureMovie, bookmarks: fixtureBookmarks })
})

export const saveBookmarks = vi.fn((_: { data: { id: string; bookmarks: Bookmarks } }): Promise<void> =>
    Promise.resolve(),
)
