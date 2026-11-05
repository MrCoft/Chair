import { describe, expect, it } from 'vitest'
import { bookmarksText, isBookmarked, setNote, toggleBookmark } from '@/bookmarks/bookmarks'
import { emptyBookmarks } from '@/format/movie'
import { fixtureMovie } from '@/test/fixtures'

const now = new Date('2026-11-03T12:00:00.000Z')
const later = new Date('2026-11-03T12:05:00.000Z')

describe('toggleBookmark', () => {
    it('adds a bookmark, then removes it', () => {
        const added = toggleBookmark(emptyBookmarks(), '2f', now)

        expect(added).toEqual({ version: 1, items: [{ code: '2f', createdAt: '2026-11-03T12:00:00.000Z' }] })
        expect(isBookmarked(added, '2f')).toBe(true)

        const removed = toggleBookmark(added, '2f', later)

        expect(removed).toEqual({ version: 1, items: [] })
        expect(isBookmarked(removed, '2f')).toBe(false)
    })

    it('leaves the other bookmarks and the input untouched', () => {
        const start = toggleBookmark(emptyBookmarks(), '1a', now)

        const both = toggleBookmark(start, '2f', later)

        expect(both.items.map((item) => item.code)).toEqual(['1a', '2f'])
        expect(start.items).toHaveLength(1)
    })
})

describe('setNote', () => {
    const marked = toggleBookmark(emptyBookmarks(), '1a', now)

    it('sets a note, and an empty note removes the field', () => {
        const noted = setNote(marked, '1a', 'x')
        expect(noted.items[0]).toEqual({ code: '1a', note: 'x', createdAt: '2026-11-03T12:00:00.000Z' })

        const cleared = setNote(noted, '1a', '')
        expect(cleared.items[0]).toEqual({ code: '1a', createdAt: '2026-11-03T12:00:00.000Z' })
        expect('note' in cleared.items[0]).toBe(false)
    })

    it('trims the note, so a blank one removes the field too', () => {
        expect(setNote(marked, '1a', '  why?  ').items[0].note).toBe('why?')
        expect('note' in setNote(setNote(marked, '1a', 'x'), '1a', '   ').items[0]).toBe(false)
    })

    it('does not bookmark a step that is not bookmarked', () => {
        expect(setNote(marked, '2f', 'x')).toEqual(marked)
    })
})

describe('bookmarksText', () => {
    it('lists the bookmarks in step order under the movie title and the folder id', () => {
        let bookmarks = toggleBookmark(emptyBookmarks(), '2f', now)
        bookmarks = toggleBookmark(bookmarks, '1a', later)
        bookmarks = setNote(bookmarks, '1a', 'no message tells the user why')

        expect(bookmarksText(bookmarks, fixtureMovie, "it's a folder")).toBe(
            ["Bookmarks — Todo app · Clear completed (it's a folder)", '1a — no message tells the user why', '2f'].join(
                '\n',
            ),
        )
    })
})
