import { useEffect } from 'react'
import type { Movie } from '@/format/movie'
import { usePlayer } from '@/player/PlayerContext'
import { neighbour } from '@/player/timeline'

type Shortcut = 'play' | 'previous' | 'next' | 'bookmark'

const SHORTCUTS = new Map<string, Shortcut>([
    [' ', 'play'],
    ['ArrowLeft', 'previous'],
    ['ArrowRight', 'next'],
    ['b', 'bookmark'],
    ['B', 'bookmark'],
])

const TYPING = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'

const isTyping = (target: EventTarget | null): boolean => target instanceof Element && target.closest(TYPING) !== null

export const useShortcuts = ({ movie, onBookmark }: { movie: Movie; onBookmark: (code: string) => void }): void => {
    const { currentStep, togglePlay, seekToStep } = usePlayer()
    const code = currentStep.code

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const shortcut = SHORTCUTS.get(event.key)
            if (!shortcut || event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return
            if (isTyping(event.target)) return
            event.preventDefault()

            if (shortcut === 'previous' || shortcut === 'next') {
                const target = neighbour(movie.steps, code, shortcut === 'next' ? 1 : -1)
                if (target) seekToStep(target.code)
            } else if (!event.repeat) {
                if (shortcut === 'play') togglePlay()
                else onBookmark(code)
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [code, movie.steps, onBookmark, seekToStep, togglePlay])
}
