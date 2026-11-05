import { useId, useState } from 'react'
import type { Bookmarks, Movie, Step } from '@/format/movie'
import { Controls } from '@/components/Controls'
import { Screen } from '@/components/Screen'
import { StepCard } from '@/components/StepCard'
import { Button } from '@/components/shadcn/button'
import { usePlayer } from '@/player/PlayerContext'
import { stepState } from '@/player/timeline'

export const Study = ({
    movie,
    bookmarks,
    videoSrc,
    onToggleBookmark,
    onNote,
}: {
    movie: Movie
    bookmarks: Bookmarks
    videoSrc: string
    onToggleBookmark: (code: string) => void
    onNote: (code: string, text: string) => void
}) => {
    const { currentStep, seekToStep } = usePlayer()
    const id = useId()
    const [bookmarkedOnly, setBookmarkedOnly] = useState(false)
    const marks = new Map(bookmarks.items.map((item) => [item.code, item]))
    const partTitles = new Map(movie.parts.map((part) => [part.code, part.title]))
    const groups: Array<{ part: string; steps: Array<Step> }> = []
    for (const step of movie.steps) {
        if (bookmarkedOnly && !marks.has(step.code)) continue
        const last = groups.at(-1)
        if (last?.part === step.part) last.steps.push(step)
        else groups.push({ part: step.part, steps: [step] })
    }

    return (
        <div className="flex min-h-0 flex-1">
            <aside aria-label="Step list" className="flex w-[38%] max-w-xl min-w-72 flex-col border-r bg-[#12162a]">
                <div className="flex items-center border-b px-3 py-2">
                    <Button
                        variant="outline"
                        size="xs"
                        aria-pressed={bookmarkedOnly}
                        onClick={() => setBookmarkedOnly((on) => !on)}
                        className="rounded-md tracking-normal normal-case aria-pressed:border-bookmark aria-pressed:bg-bookmark/15 aria-pressed:text-bookmark"
                    >
                        Bookmarked only
                    </Button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2">
                    {groups.map(({ part, steps }) => {
                        const headingId = `${id}-from-${steps[0].code}`
                        return (
                            <section key={steps[0].code} aria-labelledby={headingId} className="flex flex-col gap-1.5">
                                <h2
                                    id={headingId}
                                    className="mt-1 px-0.5 text-[11px] tracking-wider text-muted-foreground uppercase"
                                >
                                    {part} · {partTitles.get(part)}
                                </h2>
                                <ul className="flex flex-col gap-1.5">
                                    {steps.map((step) => (
                                        <StepCard
                                            key={step.code}
                                            step={step}
                                            state={stepState(movie.steps, step.code, currentStep.code)}
                                            bookmark={marks.get(step.code)}
                                            onSeek={() => seekToStep(step.code)}
                                            onNote={(text) => onNote(step.code, text)}
                                        />
                                    ))}
                                </ul>
                            </section>
                        )
                    })}
                    {groups.length === 0 && (
                        <p className="p-3 text-sm text-muted-foreground">
                            No bookmarks yet — press B to bookmark the current step.
                        </p>
                    )}
                </div>
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
                <Screen movie={movie} videoSrc={videoSrc} />
                <div className="border-t px-4 py-3">
                    <Controls movie={movie} bookmarks={bookmarks} onToggleBookmark={onToggleBookmark} />
                </div>
            </div>
        </div>
    )
}
