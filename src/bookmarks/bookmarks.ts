import type { Bookmark, Bookmarks, Movie } from '@/format/movie'

export const isBookmarked = (b: Bookmarks, code: string): boolean => b.items.some((item) => item.code === code)

export const toggleBookmark = (b: Bookmarks, code: string, now: Date): Bookmarks =>
    isBookmarked(b, code)
        ? { ...b, items: b.items.filter((item) => item.code !== code) }
        : { ...b, items: [...b.items, { code, createdAt: now.toISOString() }] }

export const setNote = (b: Bookmarks, code: string, note: string): Bookmarks => {
    const text = note.trim()
    return {
        ...b,
        items: b.items.map((item): Bookmark => {
            if (item.code !== code) return item
            const { note: _old, ...rest } = item
            return text === '' ? rest : { ...rest, note: text }
        }),
    }
}

export const bookmarksText = (b: Bookmarks, movie: Movie, folderId: string): string => {
    const notes = new Map(b.items.map((item) => [item.code, item.note]))
    const lines = movie.steps
        .filter((step) => notes.has(step.code))
        .map((step) => {
            const note = notes.get(step.code)
            return note ? `${step.code} — ${note}` : step.code
        })
    return [`Bookmarks — ${movie.title} (${folderId})`, ...lines].join('\n')
}
