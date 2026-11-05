import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { fixtureMovie } from '@/test/fixtures'
import { findVideo, renderApp } from '@/test/renderApp'
import { saveBookmarks } from '@/test/serverMocks/movies'

const moviePath = `/m/${fixtureMovie.id}`

const playTo = (video: HTMLVideoElement, seconds: number) => {
    video.currentTime = seconds
    fireEvent.timeUpdate(video)
}

const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.body) =>
    fireEvent.keyDown(target, { key, ...init })

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))

const openAt = async (search: string) => {
    renderApp(`${moviePath}${search}`)
    const video = await findVideo(fixtureMovie.title)
    return video
}

beforeEach(() => {
    saveBookmarks.mockClear()
})

describe('keyboard shortcuts', () => {
    it('b bookmarks the current step', async () => {
        const video = await openAt('')
        playTo(video, 13)

        expect(press('b')).toBe(false)

        expect(screen.getByText('2 bookmarks')).toBeInTheDocument()
        await waitFor(() => expect(saveBookmarks).toHaveBeenCalled())
        expect(saveBookmarks).toHaveBeenCalledExactlyOnceWith({
            data: {
                id: fixtureMovie.id,
                bookmarks: {
                    version: 1,
                    items: [
                        expect.objectContaining({ code: '1a' }),
                        { code: '2f', createdAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/) },
                    ],
                },
            },
        })

        press('B', { shiftKey: true })

        expect(screen.getByText('1 bookmark')).toBeInTheDocument()
        await waitFor(() => expect(saveBookmarks).toHaveBeenCalledTimes(2))
        expect(saveBookmarks.mock.lastCall?.[0].data.bookmarks.items.map((item) => item.code)).toEqual(['1a'])
    })

    it('does nothing while the note input has focus', async () => {
        const video = await openAt('?view=study&at=1a')
        await waitFor(() => expect(video.currentTime).toBe(4))
        const note = screen.getByRole('textbox', { name: 'Note for 1a' })
        note.focus()

        for (const key of ['b', ' ', 'ArrowRight', 'ArrowLeft']) expect(press(key, {}, note)).toBe(true)
        await settle()

        expect(screen.getByText('1 bookmark')).toBeInTheDocument()
        expect(saveBookmarks).not.toHaveBeenCalled()
        expect(video.currentTime).toBe(4)
        expect(video.paused).toBe(true)
    })

    it('leaves the arrow keys to a focused speed select', async () => {
        const video = await openAt('?at=1a')
        await waitFor(() => expect(video.currentTime).toBe(4))

        expect(press('ArrowRight', {}, screen.getByRole('combobox', { name: 'Speed' }))).toBe(true)

        expect(video.currentTime).toBe(4)
    })

    it('ignores keys typed into a contenteditable element', async () => {
        await openAt('')
        const editable = document.createElement('div')
        editable.setAttribute('contenteditable', 'true')
        document.body.append(editable)

        expect(press('b', {}, editable)).toBe(true)
        editable.remove()
        await settle()

        expect(saveBookmarks).not.toHaveBeenCalled()
    })

    it('ArrowRight and ArrowLeft move to the next and previous step', async () => {
        const video = await openAt('?at=1a')
        await waitFor(() => expect(video.currentTime).toBe(4))

        expect(press('ArrowRight')).toBe(false)
        expect(video.currentTime).toBe(9)

        press('ArrowLeft')
        press('ArrowLeft')
        expect(video.currentTime).toBe(0)

        press('ArrowLeft')
        expect(video.currentTime).toBe(0)
    })

    it('Space plays and pauses', async () => {
        const video = await openAt('')

        expect(press(' ')).toBe(false)
        expect(video.paused).toBe(false)

        press(' ')
        expect(video.paused).toBe(true)
    })

    it('Space plays on from the start of a step where playback stopped', async () => {
        const video = await openAt('')
        press(' ')
        playTo(video, 4.05)
        expect(video.paused).toBe(true)

        press(' ')

        expect(video.paused).toBe(false)
        expect(video.currentTime).toBe(4)
    })

    it('leaves key combinations with Ctrl, Alt or Meta to the browser', async () => {
        const video = await openAt('?at=1a')
        await waitFor(() => expect(video.currentTime).toBe(4))

        expect(press('ArrowLeft', { altKey: true })).toBe(true)
        expect(press('b', { ctrlKey: true })).toBe(true)
        expect(press(' ', { metaKey: true })).toBe(true)
        await settle()

        expect(video.currentTime).toBe(4)
        expect(video.paused).toBe(true)
        expect(saveBookmarks).not.toHaveBeenCalled()
    })

    it('does not repeat b or Space while the key is held down', async () => {
        const video = await openAt('')

        press('b', { repeat: true })
        press(' ', { repeat: true })
        await settle()

        expect(saveBookmarks).not.toHaveBeenCalled()
        expect(video.paused).toBe(true)
    })
})
