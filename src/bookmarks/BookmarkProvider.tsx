import { createContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Bookmarks } from '@/format/movie'

export type HeldBookmarks = { movieId: string; shown: Bookmarks; saved: Bookmarks; failed: boolean }

function useBookmarkState() {
    const [held, setHeld] = useState(() => new Map<string, HeldBookmarks>())
    const latest = useRef(held)
    const queue = useRef(Promise.resolve())
    return { held, setHeld, latest, queue }
}

export const BookmarkContext = createContext<ReturnType<typeof useBookmarkState> | null>(null)

// Keep pending edits alive across both movie switches and visits to the library.
export function BookmarkProvider({ children }: { children: ReactNode }) {
    const state = useBookmarkState()
    return <BookmarkContext.Provider value={state}>{children}</BookmarkContext.Provider>
}
