import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PlayerProvider } from '@/player/PlayerContext'
import { Theater } from '@/components/Theater'
import { fixtureBookmarks, fixtureMovie } from '@/test/fixtures'

const onToggleBookmark = vi.fn()

const theater = (
    <Theater
        movie={fixtureMovie}
        bookmarks={fixtureBookmarks}
        videoSrc="/media/demo/movie.mp4"
        onToggleBookmark={onToggleBookmark}
    />
)

const videoIn = (container: HTMLElement): HTMLVideoElement => {
    const video = container.querySelector('video')
    if (!video) throw new Error('no <video> rendered')
    return video
}

const renderTheater = () => {
    const view = render(<PlayerProvider movie={fixtureMovie}>{theater}</PlayerProvider>)
    return { ...view, video: videoIn(view.container) }
}

const playTo = (video: HTMLVideoElement, seconds: number) => {
    video.currentTime = seconds
    fireEvent.timeUpdate(video)
}

const segment = (code: string) =>
    within(screen.getByRole('group', { name: 'Steps' })).getByRole('button', { name: new RegExp(`^${code} ·`) })

describe('Theater', () => {
    it('shows the caption of the step playing at the current time', () => {
        const { video } = renderTheater()

        playTo(video, 13)

        const caption = screen.getByRole('region', { name: 'Caption' })
        expect(within(caption).getByText('2f')).toBeInTheDocument()
        expect(within(caption).getByText('Keep archived = OFF')).toBeInTheDocument()
        expect(within(caption).getByText('Keep archived', { selector: 'code' })).toBeInTheDocument()
        expect(screen.getByText('00:13 / 00:20')).toBeInTheDocument()
    })

    it('marks scrub segments past, current and upcoming', () => {
        const { video } = renderTheater()

        playTo(video, 10)

        expect(segment('1')).toHaveAttribute('data-state', 'past')
        expect(segment('1a')).toHaveAttribute('data-state', 'past')
        expect(segment('2')).toHaveAttribute('aria-current', 'step')
        expect(segment('2f')).toHaveAttribute('data-state', 'upcoming')
    })

    it('seeks to a step when its scrub segment is clicked', () => {
        const { video } = renderTheater()

        fireEvent.click(segment('1a'))

        expect(video.currentTime).toBe(4)
        expect(within(screen.getByRole('region', { name: 'Caption' })).getByText('Pick a todo')).toBeInTheDocument()
    })

    it('flags bookmarked steps in the scrub bar', () => {
        renderTheater()

        expect(segment('1a')).toHaveTextContent('⚑')
        expect(segment('2f')).not.toHaveTextContent('⚑')
    })

    it('bookmarks the current step from the controls', () => {
        const { video } = renderTheater()
        onToggleBookmark.mockClear()

        fireEvent.click(segment('1a'))
        const bookmark = screen.getByRole('button', { name: /bookmark 1a/i })
        expect(bookmark).toHaveAttribute('aria-pressed', 'true')
        fireEvent.click(bookmark)
        expect(onToggleBookmark).toHaveBeenCalledExactlyOnceWith('1a')

        playTo(video, 13)
        expect(screen.getByRole('button', { name: /bookmark 2f/i })).toHaveAttribute('aria-pressed', 'false')
    })

    it('moves to the previous and next step', () => {
        const { video } = renderTheater()

        expect(screen.getByRole('button', { name: 'Previous step' })).toBeDisabled()
        fireEvent.click(segment('1a'))
        fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
        expect(video.currentTime).toBe(9)
        fireEvent.click(screen.getByRole('button', { name: 'Previous step' }))
        expect(video.currentTime).toBe(4)
    })

    it('plays, pauses and changes speed', () => {
        const { video } = renderTheater()

        fireEvent.click(screen.getByRole('button', { name: 'Play' }))
        expect(video.paused).toBe(false)
        fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
        expect(video.paused).toBe(true)

        fireEvent.change(screen.getByRole('combobox', { name: 'Speed' }), { target: { value: '1.5' } })
        expect(video.playbackRate).toBe(1.5)
    })

    it('keeps the moment when the video is replaced', () => {
        const { video, rerender, container } = renderTheater()
        playTo(video, 13)

        rerender(<PlayerProvider movie={fixtureMovie}>{null}</PlayerProvider>)
        rerender(<PlayerProvider movie={fixtureMovie}>{theater}</PlayerProvider>)

        const replaced = videoIn(container)
        expect(replaced).not.toBe(video)
        expect(replaced.currentTime).toBe(13)
    })

    it('says so when the video cannot be played', () => {
        const { video } = renderTheater()

        fireEvent.error(video)

        expect(screen.getByText(/can't play movie\.mp4/i)).toBeInTheDocument()
    })
})

describe('Theater pauses at the start of each step', () => {
    const caption = () => screen.getByRole('region', { name: 'Caption' })

    it('stops at the start of the next step and plays on when you press Play', () => {
        const { video } = renderTheater()
        fireEvent.click(screen.getByRole('button', { name: 'Play' }))

        playTo(video, 4.05)

        expect(video.paused).toBe(true)
        expect(video.currentTime).toBe(4)
        expect(within(caption()).getByText('Pick a todo')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Play' }))
        playTo(video, 4.5)
        expect(video.paused).toBe(false)
        playTo(video, 9.02)
        expect(video.paused).toBe(true)
        expect(video.currentTime).toBe(9)
    })

    it('waits at the start of a step you jump to while playing', () => {
        const { video } = renderTheater()
        fireEvent.click(screen.getByRole('button', { name: 'Play' }))

        fireEvent.click(segment('2'))

        expect(video.paused).toBe(true)
        expect(video.currentTime).toBe(9)
        expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    })

    it('stays put while paused', () => {
        const { video } = renderTheater()

        playTo(video, 4.05)

        expect(video.currentTime).toBe(4.05)
    })
})
