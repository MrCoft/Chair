import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import type { Bookmarks, Movie } from '@/format/movie'
import { Study } from '@/components/Study'
import { emptyBookmarks, movieSchema } from '@/format/movie'
import { PlayerProvider } from '@/player/PlayerContext'
import { fixtureBookmarks, fixtureMovie } from '@/test/fixtures'
import { findVideo, renderApp } from '@/test/renderApp'
import { getMovie } from '@/test/serverMocks/movies'

const card = (code: string) => screen.getByRole('listitem', { name: new RegExp(`^${code} ·`) })
const queryCard = (code: string) => screen.queryByRole('listitem', { name: new RegExp(`^${code} ·`) })
const note = (code: string) => screen.getByRole('textbox', { name: `Note for ${code}` })

const playTo = (video: HTMLVideoElement, seconds: number) => {
    video.currentTime = seconds
    fireEvent.timeUpdate(video)
}

const renderStudy = (bookmarks: Bookmarks = fixtureBookmarks, movie: Movie = fixtureMovie) => {
    const onNote = vi.fn()
    const onToggleBookmark = vi.fn()
    const view = render(
        <PlayerProvider movie={movie}>
            <Study
                movie={movie}
                bookmarks={bookmarks}
                videoSrc="/media/demo/movie.mp4"
                onToggleBookmark={onToggleBookmark}
                onNote={onNote}
            />
        </PlayerProvider>,
    )
    const video = view.container.querySelector('video')
    if (!video) throw new Error('no <video> rendered')
    return { video, onNote, onToggleBookmark }
}

let scrollIntoView: MockInstance<Element['scrollIntoView']>

beforeEach(() => {
    scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView')
})

afterEach(() => {
    scrollIntoView.mockRestore()
})

describe('Study', () => {
    it('lists the step cards under their part headings', () => {
        renderStudy()

        expect(screen.getByRole('heading', { name: '1 · Setup' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '2 · Clearing todos' })).toBeInTheDocument()
        const part2 = screen.getByRole('region', { name: '2 · Clearing todos' })
        expect(
            within(part2)
                .getAllByRole('listitem')
                .map((item) => item.getAttribute('aria-label')),
        ).toEqual(['2 · Open completed', '2f · Keep archived = OFF'])

        const deleting = card('2f')
        expect(within(deleting).getByText('2f')).toBeInTheDocument()
        expect(within(deleting).getByText('Keep archived = OFF')).toBeInTheDocument()
        expect(within(deleting).getByText('Keep archived', { selector: 'code' })).toBeInTheDocument()
        expect(deleting).not.toHaveTextContent('⚑')

        expect(card('1a')).toHaveTextContent('⚑')
        expect(note('1a')).toHaveValue('no message tells the user why')
        expect(within(card('2f')).queryByRole('textbox')).not.toBeInTheDocument()
    })

    it('lists the cards in playback order, with a new heading whenever the part changes', () => {
        const [one, , two] = fixtureMovie.steps
        const backToSetup = movieSchema.parse({
            ...fixtureMovie,
            durationMs: 12000,
            steps: [
                { ...one, startMs: 0, durationMs: 4000 },
                { ...two, startMs: 4000, durationMs: 3000 },
                { ...one, code: '1b', title: 'Back to setup', startMs: 7000, durationMs: 5000 },
            ],
        })

        renderStudy(emptyBookmarks(), backToSetup)

        const sections = screen.getAllByRole('region')
        expect(sections.map((section) => within(section).getByRole('heading').textContent)).toEqual([
            '1 · Setup',
            '2 · Clearing todos',
            '1 · Setup',
        ])
        expect(
            sections.map((section) =>
                within(section)
                    .getAllByRole('listitem')
                    .map((item) => item.getAttribute('aria-label')),
            ),
        ).toEqual([['1 · Open the page'], ['2 · Open completed'], ['1b · Back to setup']])
    })

    it('marks the playing card current, scrolls it into view and dims the past ones', () => {
        const { video } = renderStudy()

        playTo(video, 13)

        expect(card('2f')).toHaveAttribute('aria-current', 'step')
        expect(scrollIntoView.mock.contexts.at(-1)).toBe(card('2f'))
        expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'nearest', behavior: 'smooth' })
        expect(card('1')).toHaveAttribute('data-state', 'past')
        expect(card('1a')).toHaveAttribute('data-state', 'past')
        expect(card('2')).toHaveAttribute('data-state', 'past')
        expect(card('1')).not.toHaveAttribute('aria-current')
    })

    it('shows only the bookmarked cards when "Bookmarked only" is on', () => {
        renderStudy()
        const toggle = screen.getByRole('button', { name: 'Bookmarked only' })

        fireEvent.click(toggle)

        expect(toggle).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getAllByRole('listitem')).toEqual([card('1a')])
        expect(screen.queryByRole('heading', { name: '2 · Clearing todos' })).not.toBeInTheDocument()

        fireEvent.click(toggle)

        expect(screen.getAllByRole('listitem')).toHaveLength(4)
    })

    it('says so when "Bookmarked only" finds nothing', () => {
        renderStudy(emptyBookmarks())

        fireEvent.click(screen.getByRole('button', { name: 'Bookmarked only' }))

        expect(queryCard('1')).not.toBeInTheDocument()
        expect(screen.getByText(/no bookmarks yet/i)).toBeInTheDocument()
    })

    it('seeks to a card when it is clicked', () => {
        const { video } = renderStudy()

        fireEvent.click(within(card('1a')).getByRole('button'))

        expect(video.currentTime).toBe(4)
        expect(card('1a')).toHaveAttribute('aria-current', 'step')
    })

    it('saves an edited note on blur and on Enter', () => {
        const { onNote } = renderStudy()

        fireEvent.change(note('1a'), { target: { value: 'still no message' } })
        fireEvent.blur(note('1a'))

        expect(onNote).toHaveBeenCalledExactlyOnceWith('1a', 'still no message')

        note('1a').focus()
        fireEvent.change(note('1a'), { target: { value: 'nothing at all' } })
        fireEvent.keyDown(note('1a'), { key: 'Enter' })

        expect(note('1a')).not.toHaveFocus()
        expect(onNote).toHaveBeenLastCalledWith('1a', 'nothing at all')
        expect(onNote).toHaveBeenCalledTimes(2)
    })

    it('does not save a note that did not change', () => {
        const { onNote } = renderStudy()

        note('1a').focus()
        fireEvent.blur(note('1a'))

        expect(onNote).not.toHaveBeenCalled()
    })

    it('bookmarks the current step with the same controls as Theater', () => {
        const { video, onToggleBookmark } = renderStudy()
        playTo(video, 13)

        fireEvent.click(screen.getByRole('button', { name: /bookmark 2f/i }))

        expect(onToggleBookmark).toHaveBeenCalledExactlyOnceWith('2f')
    })
})

describe('the Study view in the movie page', () => {
    const moviePath = `/m/${fixtureMovie.id}`

    it('keeps the current step when switching to Theater and back', async () => {
        renderApp(`${moviePath}?view=study`)
        const video = await findVideo(fixtureMovie.title)
        playTo(video, 13)
        expect(card('2f')).toHaveAttribute('aria-current', 'step')

        fireEvent.click(screen.getByRole('link', { name: 'Theater' }))
        const caption = await screen.findByRole('region', { name: 'Caption' })
        expect(within(caption).getByText('2f')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('link', { name: 'Study' }))

        await waitFor(() => expect(card('2f')).toHaveAttribute('aria-current', 'step'))
        expect(document.querySelector('video')?.currentTime).toBe(13)
    })

    it('keeps a new bookmark when the movie is loaded again', async () => {
        const original = getMovie.getMockImplementation()
        getMovie.mockImplementation(() =>
            Promise.resolve({ movie: fixtureMovie, bookmarks: structuredClone(fixtureBookmarks) }),
        )
        onTestFinished(() => {
            if (original) getMovie.mockImplementation(original)
        })
        const router = renderApp(`${moviePath}?view=study`)
        const video = await findVideo(fixtureMovie.title)
        playTo(video, 13)

        fireEvent.click(screen.getByRole('button', { name: /bookmark 2f/i }))
        expect(card('2f')).toHaveTextContent('⚑')
        expect(screen.getByText('2 bookmarks')).toBeInTheDocument()

        const loads = getMovie.mock.calls.length
        await act(() => router.invalidate())

        expect(getMovie).toHaveBeenCalledTimes(loads + 1)
        expect(card('2f')).toHaveTextContent('⚑')
        expect(screen.getByText('2 bookmarks')).toBeInTheDocument()
    })
})
