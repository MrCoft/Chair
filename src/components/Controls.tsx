import { PauseIcon } from '@phosphor-icons/react/dist/csr/Pause'
import { PlayIcon } from '@phosphor-icons/react/dist/csr/Play'
import { SkipBackIcon } from '@phosphor-icons/react/dist/csr/SkipBack'
import { SkipForwardIcon } from '@phosphor-icons/react/dist/csr/SkipForward'
import type { Bookmarks, Movie } from '@/format/movie'
import { isBookmarked } from '@/bookmarks/bookmarks'
import { Button } from '@/components/shadcn/button'
import { usePlayer } from '@/player/PlayerContext'
import { formatTime, neighbour } from '@/player/timeline'

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

const control = 'rounded-md normal-case tracking-normal'

export const Controls = ({
    movie,
    bookmarks,
    onToggleBookmark,
}: {
    movie: Movie
    bookmarks: Bookmarks
    onToggleBookmark: (code: string) => void
}) => {
    const { currentMs, currentStep, playing, rate, setRate, togglePlay, seekToStep } = usePlayer()
    const previous = neighbour(movie.steps, currentStep.code, -1)
    const next = neighbour(movie.steps, currentStep.code, 1)

    return (
        <div className="flex items-center gap-2 text-sm">
            <Button
                variant="outline"
                size="icon-sm"
                className={control}
                aria-label="Previous step"
                disabled={!previous}
                onClick={() => previous && seekToStep(previous.code)}
            >
                <SkipBackIcon weight="fill" />
            </Button>
            <Button size="icon-sm" className={control} aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlay}>
                {playing ? <PauseIcon weight="fill" /> : <PlayIcon weight="fill" />}
            </Button>
            <Button
                variant="outline"
                size="icon-sm"
                className={control}
                aria-label="Next step"
                disabled={!next}
                onClick={() => next && seekToStep(next.code)}
            >
                <SkipForwardIcon weight="fill" />
            </Button>
            <select
                aria-label="Speed"
                value={String(rate)}
                onChange={(event) => setRate(Number(event.target.value))}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
                {RATES.map((r) => (
                    <option key={r} value={String(r)}>
                        {r}×
                    </option>
                ))}
            </select>
            <Button
                variant="outline"
                size="sm"
                className={`${control} border-bookmark text-bookmark hover:text-bookmark aria-pressed:bg-bookmark/15`}
                aria-pressed={isBookmarked(bookmarks, currentStep.code)}
                onClick={() => onToggleBookmark(currentStep.code)}
            >
                ⚑ Bookmark {currentStep.code} (B)
            </Button>
            <span className="ml-auto text-muted-foreground tabular-nums">
                {formatTime(currentMs)} / {formatTime(movie.durationMs)}
            </span>
        </div>
    )
}
