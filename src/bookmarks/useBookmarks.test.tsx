import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import type { Bookmarks } from '@/format/movie'
import { useBookmarks } from '@/bookmarks/useBookmarks'
import { fixtureBookmarks } from '@/test/fixtures'
import { saveBookmarks } from '@/test/serverMocks/movies'

const folder = "it's a folder"
const codes = (bookmarks: Bookmarks) => bookmarks.items.map((item) => item.code)

const renderBookmarks = () =>
    renderHook(({ movieId, initial }) => useBookmarks(movieId, initial), {
        initialProps: { movieId: folder, initial: fixtureBookmarks },
    })

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))

const deferred = () => {
    let resolve = () => {}
    let reject = (_: Error) => {}
    const promise = new Promise<void>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

beforeEach(() => {
    saveBookmarks.mockReset()
    saveBookmarks.mockResolvedValue(undefined)
})

describe('useBookmarks', () => {
    it('shows a toggle at once and saves it under the folder id', async () => {
        const { result } = renderBookmarks()

        act(() => result.current.toggle('2f'))

        expect(codes(result.current.bookmarks)).toEqual(['1a', '2f'])
        await settle()
        expect(saveBookmarks).toHaveBeenCalledExactlyOnceWith({
            data: { id: folder, bookmarks: result.current.bookmarks },
        })
    })

    it('saves an edited note', async () => {
        const { result } = renderBookmarks()

        act(() => result.current.note('1a', 'still no message'))

        expect(result.current.bookmarks.items[0].note).toBe('still no message')
        await settle()
        expect(saveBookmarks).toHaveBeenLastCalledWith({ data: { id: folder, bookmarks: result.current.bookmarks } })
    })

    it('keeps its bookmarks when the loader hands the same movie in again', () => {
        const { result, rerender } = renderBookmarks()
        act(() => result.current.toggle('2f'))

        rerender({ movieId: folder, initial: structuredClone(fixtureBookmarks) })

        expect(codes(result.current.bookmarks)).toEqual(['1a', '2f'])
    })

    it('starts over from the bookmarks of a different movie', async () => {
        const { result, rerender } = renderBookmarks()
        act(() => result.current.toggle('2f'))

        rerender({ movieId: 'other', initial: { version: 1, items: [] } })
        expect(result.current.bookmarks.items).toEqual([])

        act(() => result.current.toggle('1'))
        expect(codes(result.current.bookmarks)).toEqual(['1'])
        await settle()
        expect(saveBookmarks).toHaveBeenLastCalledWith({ data: { id: 'other', bookmarks: result.current.bookmarks } })
    })

    it('sends saves one after another, the newest last', async () => {
        const first = deferred()
        saveBookmarks.mockReturnValueOnce(first.promise)
        const { result } = renderBookmarks()

        act(() => result.current.toggle('2f'))
        act(() => result.current.toggle('2'))
        await settle()

        expect(saveBookmarks).toHaveBeenCalledTimes(1)

        first.resolve()
        await settle()

        expect(saveBookmarks).toHaveBeenCalledTimes(2)
        expect(saveBookmarks.mock.lastCall?.[0].data.bookmarks.items.map((item) => item.code)).toEqual([
            '1a',
            '2f',
            '2',
        ])
    })

    it('goes back to the saved bookmarks when a save fails', async () => {
        vi.spyOn(console, 'error').mockImplementationOnce(() => {})
        const failing = deferred()
        saveBookmarks.mockReturnValueOnce(failing.promise)
        const { result } = renderBookmarks()

        act(() => result.current.toggle('2f'))
        expect(codes(result.current.bookmarks)).toEqual(['1a', '2f'])

        failing.reject(new Error('disk full'))
        await settle()

        expect(codes(result.current.bookmarks)).toEqual(['1a'])
    })

    it('reports a failed save until the next one succeeds', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        onTestFinished(() => error.mockRestore())
        const failure = new Error('disk full')
        saveBookmarks.mockRejectedValueOnce(failure)
        const { result } = renderBookmarks()
        expect(result.current.saveFailed).toBe(false)

        act(() => result.current.toggle('2f'))
        await settle()

        expect(result.current.saveFailed).toBe(true)
        expect(error).toHaveBeenCalledExactlyOnceWith("Couldn't save bookmarks", failure)

        act(() => result.current.toggle('2'))
        expect(result.current.saveFailed).toBe(true)
        await settle()

        expect(result.current.saveFailed).toBe(false)
        expect(codes(result.current.bookmarks)).toEqual(['1a', '2'])
    })

    it('still sends the next save after one fails, and keeps what it saved', async () => {
        const failing = deferred()
        saveBookmarks.mockReturnValueOnce(failing.promise)
        const { result } = renderBookmarks()

        vi.spyOn(console, 'error').mockImplementationOnce(() => {})
        act(() => result.current.toggle('2f'))
        act(() => result.current.toggle('2'))
        failing.reject(new Error('disk full'))
        await settle()

        expect(saveBookmarks).toHaveBeenCalledTimes(2)
        expect(codes(result.current.bookmarks)).toEqual(['1a', '2f', '2'])
    })
})
