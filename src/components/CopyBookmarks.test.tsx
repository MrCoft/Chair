import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bookmarksText } from '@/bookmarks/bookmarks'
import { CopyBookmarks } from '@/components/CopyBookmarks'
import { emptyBookmarks } from '@/format/movie'
import { fixtureBookmarks, fixtureMovie } from '@/test/fixtures'

const writeText = vi.fn<(text: string) => Promise<void>>()
const folder = "it's a folder"

beforeEach(() => {
    writeText.mockReset()
    writeText.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
})

afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard')
})

describe('CopyBookmarks', () => {
    it('copies the bookmarks as text and says so', async () => {
        render(<CopyBookmarks id={folder} movie={fixtureMovie} bookmarks={fixtureBookmarks} />)

        fireEvent.click(screen.getByRole('button', { name: 'Copy bookmarks' }))

        expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
        expect(writeText).toHaveBeenCalledExactlyOnceWith(bookmarksText(fixtureBookmarks, fixtureMovie, folder))
        expect(writeText.mock.calls[0][0]).toBe(
            "Bookmarks — Todo app · Clear completed (it's a folder)\n1a — no message tells the user why",
        )
    })

    it('says so when the clipboard refuses', async () => {
        writeText.mockRejectedValueOnce(new Error('denied'))
        render(<CopyBookmarks id={folder} movie={fixtureMovie} bookmarks={fixtureBookmarks} />)

        fireEvent.click(screen.getByRole('button', { name: 'Copy bookmarks' }))

        expect(await screen.findByRole('button', { name: 'Copy failed' })).toBeInTheDocument()
    })

    it('is disabled while there is nothing to copy', () => {
        render(<CopyBookmarks id={folder} movie={fixtureMovie} bookmarks={emptyBookmarks()} />)

        expect(screen.getByRole('button', { name: 'Copy bookmarks' })).toBeDisabled()
    })
})
