import type { Bookmarks, Movie } from '../format/movie'
import type { MovieRef } from '../server/library.server'

export const fixtureMovie: Movie = {
    version: 1,
    id: '2026-11-03-todo-cleanup',
    title: 'Todo app · Clear completed',
    scope: 'Clear completed',
    createdAt: '2026-11-03T10:00:00.000Z',
    video: 'movie.mp4',
    durationMs: 20000,
    parts: [
        { code: '1', title: 'Setup' },
        { code: '2', title: 'Clearing todos' },
    ],
    steps: [
        {
            code: '1',
            part: '1',
            title: 'Open the page',
            text: 'Open **Todos**.',
            startMs: 0,
            durationMs: 4000,
            actions: [],
        },
        {
            code: '1a',
            part: '1',
            title: 'Pick a todo',
            text: 'Pick a todo.',
            startMs: 4000,
            durationMs: 5000,
            actions: [{ kind: 'click', target: 'todo-row', atMs: 500 }],
        },
        {
            code: '2',
            part: '2',
            title: 'Open completed',
            text: 'Open completed.',
            startMs: 9000,
            durationMs: 3000,
            actions: [],
        },
        {
            code: '2f',
            part: '2',
            title: 'Keep archived = OFF',
            text: 'Leave `Keep archived` off.',
            startMs: 12000,
            durationMs: 8000,
            actions: [],
        },
    ],
}

export const fixtureBookmarks: Bookmarks = {
    version: 1,
    items: [{ code: '1a', note: 'no message tells the user why', createdAt: '2026-11-03T11:00:00.000Z' }],
}

export const fixtureRef: MovieRef = {
    id: fixtureMovie.id,
    title: fixtureMovie.title,
    scope: fixtureMovie.scope,
    createdAt: fixtureMovie.createdAt,
    steps: fixtureMovie.steps.length,
    durationMs: fixtureMovie.durationMs,
}
