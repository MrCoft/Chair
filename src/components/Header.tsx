import { Link } from '@tanstack/react-router'
import type { Bookmarks, Movie } from '@/format/movie'
import { CopyBookmarks } from '@/components/CopyBookmarks'
import { Button } from '@/components/shadcn/button'
import { cn } from '@/lib/utils'
import { formatTime } from '@/player/timeline'

export type View = 'theater' | 'study'

const VIEWS: Array<{ view: View; label: string }> = [
    { view: 'theater', label: 'Theater' },
    { view: 'study', label: 'Study' },
]

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`

const extensionOf = (file: string): string => /\.[^./\\]+$/.exec(file)?.[0] ?? ''

export const Header = ({
    id,
    movie,
    bookmarks,
    saveFailed,
    view,
    downloadSrc,
}: {
    id: string
    movie: Movie
    bookmarks: Bookmarks
    saveFailed: boolean
    view: View
    downloadSrc: string
}) => (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-card px-4 py-2 text-sm">
        <h1 className="font-bold">{movie.title}</h1>
        <span className="font-mono text-xs text-muted-foreground">{id}</span>
        <span className="flex items-center gap-2 text-muted-foreground">
            <span>{movie.scope}</span>·<span>{plural(movie.steps.length, 'step')}</span>·
            <span>{formatTime(movie.durationMs)}</span>
        </span>
        <span className="text-bookmark">
            ⚑ <span>{plural(bookmarks.items.length, 'bookmark')}</span>
        </span>
        <CopyBookmarks id={id} movie={movie} bookmarks={bookmarks} />
        <Button asChild variant="outline" size="xs" className="rounded-md tracking-normal normal-case">
            <a href={downloadSrc} download={`${id}${extensionOf(downloadSrc)}`}>
                Download movie
            </a>
        </Button>
        {saveFailed && (
            <span role="alert" className="font-semibold text-destructive">
                Couldn't save bookmarks
            </span>
        )}
        <nav aria-label="View" className="ml-auto flex overflow-hidden rounded-md border border-input">
            {VIEWS.map((item) => (
                <Link
                    key={item.view}
                    from="/m/$id"
                    to="."
                    search={(prev) => ({ ...prev, view: item.view })}
                    aria-current={view === item.view ? 'page' : undefined}
                    className={cn(
                        'px-3 py-1 text-xs text-muted-foreground',
                        view === item.view && 'bg-primary font-bold text-primary-foreground',
                    )}
                >
                    {item.label}
                </Link>
            ))}
        </nav>
    </header>
)
