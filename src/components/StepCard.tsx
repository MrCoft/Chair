import { useEffect, useRef, useState } from 'react'
import type { Bookmark, Step } from '@/format/movie'
import type { StepState } from '@/player/timeline'
import { CaptionText } from '@/components/CaptionText'
import { cn } from '@/lib/utils'

const CARD_CLASSES: Record<StepState, string> = {
    past: 'border-[#2a3052] bg-card opacity-55 hover:border-border',
    current: 'border-primary bg-[#1f2440] ring-3 ring-primary/15',
    upcoming: 'border-[#2a3052] bg-card hover:border-border',
}

const NoteInput = ({ code, note, onNote }: { code: string; note: string; onNote: (text: string) => void }) => {
    const [draft, setDraft] = useState(note)

    return (
        <input
            aria-label={`Note for ${code}`}
            placeholder="Add a note…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
                if (draft.trim() !== note) onNote(draft)
            }}
            onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
            }}
            className="relative mt-1.5 w-full border-l-2 border-bookmark bg-transparent py-0.5 pl-1.5 text-xs text-[#ff8fb3] outline-none placeholder:text-[#ff8fb3]/50 focus:bg-black/20"
        />
    )
}

export const StepCard = ({
    step,
    state,
    bookmark,
    onSeek,
    onNote,
}: {
    step: Step
    state: StepState
    bookmark: Bookmark | undefined
    onSeek: () => void
    onNote: (text: string) => void
}) => {
    const ref = useRef<HTMLLIElement>(null)
    const current = state === 'current'

    useEffect(() => {
        if (current) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, [current])

    return (
        <li
            ref={ref}
            aria-label={`${step.code} · ${step.title}`}
            aria-current={current ? 'step' : undefined}
            data-state={state}
            className={cn('relative rounded-md border px-2.5 py-2 transition-opacity', CARD_CLASSES[state])}
        >
            <button
                type="button"
                onClick={onSeek}
                className="flex w-full cursor-pointer items-baseline gap-1.5 text-left outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
                <span
                    className={cn(
                        'min-w-[22px] shrink-0 rounded px-1.5 text-center text-[11px] font-bold',
                        current ? 'bg-primary text-primary-foreground' : 'bg-secondary',
                    )}
                >
                    {step.code}
                </span>
                <span className="font-semibold">{step.title}</span>
                {bookmark && <span className="ml-auto text-bookmark">⚑</span>}
            </button>
            <CaptionText text={step.text} className="relative mt-1 text-[13px] leading-snug text-[#b5b9d6]" />
            {bookmark && (
                <NoteInput key={bookmark.note ?? ''} code={step.code} note={bookmark.note ?? ''} onNote={onNote} />
            )}
        </li>
    )
}
