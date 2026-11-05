import type { StepState } from '@/player/timeline'
import type { Bookmarks, Movie } from '@/format/movie'
import { cn } from '@/lib/utils'
import { usePlayer } from '@/player/PlayerContext'
import { segments, stepState } from '@/player/timeline'

const STATE_CLASSES: Record<StepState, string> = {
    past: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    current: 'bg-primary font-bold text-primary-foreground',
    upcoming: 'text-[#7d84a8] hover:bg-secondary/40',
}

export const ScrubBar = ({ movie, bookmarks }: { movie: Movie; bookmarks: Bookmarks }) => {
    const { currentMs, currentStep, seekToStep } = usePlayer()
    const flagged = new Set(bookmarks.items.map((item) => item.code))
    const widths = segments(movie.steps, movie.durationMs)
    const playheadPct = movie.durationMs > 0 ? Math.min(100, (currentMs * 100) / movie.durationMs) : 0

    return (
        <div role="group" aria-label="Steps" className="relative flex h-8 w-full overflow-hidden rounded bg-muted">
            {movie.steps.map((step, index) => {
                const state = stepState(movie.steps, step.code, currentStep.code)
                const bookmarked = flagged.has(step.code)
                return (
                    <button
                        key={step.code}
                        type="button"
                        data-state={state}
                        aria-current={state === 'current' ? 'step' : undefined}
                        aria-label={`${step.code} · ${step.title}${bookmarked ? ' · bookmarked' : ''}`}
                        title={`${step.code} · ${step.title}`}
                        style={{ width: `${widths[index].widthPct}%` }}
                        onClick={() => seekToStep(step.code)}
                        className={cn(
                            'min-w-0 cursor-pointer truncate border-r border-background px-1.5 text-left text-[11px] transition-colors',
                            STATE_CLASSES[state],
                        )}
                    >
                        {step.code}
                        {bookmarked && <span className="ml-0.5 text-bookmark">⚑</span>}
                    </button>
                )
            })}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/80"
                style={{ left: `${playheadPct}%` }}
            />
        </div>
    )
}
