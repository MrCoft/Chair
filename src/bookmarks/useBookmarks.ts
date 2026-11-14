import { useCallback, useContext } from 'react'
import type { Bookmarks } from '@/format/movie'
import type { HeldBookmarks } from '@/bookmarks/BookmarkProvider'
import { setNote, toggleBookmark } from '@/bookmarks/bookmarks'
import { saveBookmarks } from '@/server/movies'
import { BookmarkContext } from '@/bookmarks/BookmarkProvider'

export type BookmarksState = {
    bookmarks: Bookmarks
    saveFailed: boolean
    toggle: (code: string) => void
    note: (code: string, text: string) => void
}

const start = (movieId: string, initial: Bookmarks): HeldBookmarks => ({
    movieId,
    shown: initial,
    saved: initial,
    failed: false,
})

export const useBookmarks = (movieId: string, initial: Bookmarks): BookmarksState => {
    const state = useContext(BookmarkContext)
    if (!state) throw new Error('BookmarkProvider is missing')
    const { held, setHeld, latest, queue } = state

    const change = useCallback(
        (edit: (b: Bookmarks) => Bookmarks) => {
            const hold = (next: HeldBookmarks) => {
                const records = new Map(latest.current)
                records.set(next.movieId, next)
                latest.current = records
                setHeld(records)
            }
            const before = latest.current.get(movieId) ?? start(movieId, initial)
            const shown = edit(before.shown)
            hold({ ...before, shown })

            queue.current = queue.current
                .then(() => saveBookmarks({ data: { id: movieId, bookmarks: shown } }))
                .then(
                    () => {
                        const current = latest.current.get(movieId)
                        if (current) hold({ ...current, saved: shown, failed: false })
                    },
                    (error: unknown) => {
                        console.error("Couldn't save bookmarks", error)
                        const current = latest.current.get(movieId)
                        if (!current) return
                        hold({
                            ...current,
                            shown: current.shown === shown ? current.saved : current.shown,
                            failed: true,
                        })
                    },
                )
        },
        [movieId, initial, setHeld, latest, queue],
    )

    const toggle = useCallback((code: string) => change((b) => toggleBookmark(b, code, new Date())), [change])
    const note = useCallback((code: string, text: string) => change((b) => setNote(b, code, text)), [change])

    const own = held.get(movieId)
    return { bookmarks: own?.shown ?? initial, saveFailed: own?.failed ?? false, toggle, note }
}
