import { useCallback, useRef, useState } from 'react'
import type { Bookmarks } from '@/format/movie'
import { setNote, toggleBookmark } from '@/bookmarks/bookmarks'
import { saveBookmarks } from '@/server/movies'

type Held = { movieId: string; shown: Bookmarks; saved: Bookmarks; failed: boolean }

export type BookmarksState = {
    bookmarks: Bookmarks
    saveFailed: boolean
    toggle: (code: string) => void
    note: (code: string, text: string) => void
}

const start = (movieId: string, initial: Bookmarks): Held => ({
    movieId,
    shown: initial,
    saved: initial,
    failed: false,
})

export const useBookmarks = (movieId: string, initial: Bookmarks): BookmarksState => {
    const [held, setHeld] = useState(() => start(movieId, initial))
    const latest = useRef(held)
    const queue = useRef(Promise.resolve())

    const change = useCallback(
        (edit: (b: Bookmarks) => Bookmarks) => {
            const hold = (next: Held) => {
                latest.current = next
                setHeld(next)
            }
            const before = latest.current.movieId === movieId ? latest.current : start(movieId, initial)
            const shown = edit(before.shown)
            hold({ ...before, shown })

            queue.current = queue.current
                .then(() => saveBookmarks({ data: { id: movieId, bookmarks: shown } }))
                .then(
                    () => {
                        if (latest.current.movieId === movieId) hold({ ...latest.current, saved: shown, failed: false })
                    },
                    (error: unknown) => {
                        console.error("Couldn't save bookmarks", error)
                        const current = latest.current
                        if (current.movieId !== movieId) return
                        hold({
                            ...current,
                            shown: current.shown === shown ? current.saved : current.shown,
                            failed: true,
                        })
                    },
                )
        },
        [movieId, initial],
    )

    const toggle = useCallback((code: string) => change((b) => toggleBookmark(b, code, new Date())), [change])
    const note = useCallback((code: string, text: string) => change((b) => setNote(b, code, text)), [change])

    const own = held.movieId === movieId
    return { bookmarks: own ? held.shown : initial, saveFailed: own && held.failed, toggle, note }
}
