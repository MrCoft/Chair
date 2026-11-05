import { useEffect, useState } from 'react'
import type { Bookmarks, Movie } from '@/format/movie'
import { bookmarksText } from '@/bookmarks/bookmarks'
import { Button } from '@/components/shadcn/button'

type Outcome = 'idle' | 'copied' | 'failed'

const LABELS: Record<Outcome, string> = { idle: 'Copy bookmarks', copied: 'Copied', failed: 'Copy failed' }

export const CopyBookmarks = ({ id, movie, bookmarks }: { id: string; movie: Movie; bookmarks: Bookmarks }) => {
    const [outcome, setOutcome] = useState<Outcome>('idle')

    useEffect(() => {
        if (outcome === 'idle') return
        const timer = setTimeout(() => setOutcome('idle'), 2000)
        return () => clearTimeout(timer)
    }, [outcome])

    const copy = () => {
        Promise.resolve()
            .then(() => navigator.clipboard.writeText(bookmarksText(bookmarks, movie, id)))
            .then(
                () => setOutcome('copied'),
                () => setOutcome('failed'),
            )
    }

    return (
        <Button
            variant="outline"
            size="xs"
            disabled={bookmarks.items.length === 0}
            onClick={copy}
            className="rounded-md tracking-normal normal-case"
        >
            {LABELS[outcome]}
        </Button>
    )
}
