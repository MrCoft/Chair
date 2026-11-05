import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RouterProvider } from '@tanstack/react-router'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { readMovie } from '@/server/library.server'
import { createAppRouter, expectLoaderError, findVideo, renderApp } from '@/test/renderApp'
import { getMovie, saveBookmarks } from '@/test/serverMocks/movies'
import { fixtureBookmarks, fixtureMovie } from '@/test/fixtures'

const moviePath = `/m/${fixtureMovie.id}`

const serveFolder = async (id: string, files: Record<string, string>) => {
    const root = await mkdtemp(join(tmpdir(), 'chair route '))
    onTestFinished(() => rm(root, { recursive: true, force: true }))
    await mkdir(join(root, id))
    for (const [name, text] of Object.entries(files)) await writeFile(join(root, id, name), text)
    getMovie.mockImplementationOnce(({ data }) => readMovie(root, data.id))
}

describe('the movie route', () => {
    it('seeks to the step named by ?at on load', async () => {
        renderApp(`${moviePath}?at=1a`)
        const video = await findVideo(fixtureMovie.title)

        await waitFor(() => expect(video.currentTime).toBe(4))
        expect(within(screen.getByRole('region', { name: 'Caption' })).getByText('Pick a todo')).toBeInTheDocument()
    })

    it('reads a bare-number ?at as a step code', async () => {
        renderApp(`${moviePath}?at=2`)
        const video = await findVideo(fixtureMovie.title)

        await waitFor(() => expect(video.currentTime).toBe(9))
        expect(screen.getByRole('link', { name: 'Study' })).toHaveAttribute('href', `${moviePath}?at=2&view=study`)
    })

    it('shows the movie facts in the header', async () => {
        renderApp(moviePath)
        await findVideo(fixtureMovie.title)

        expect(screen.getByText(fixtureMovie.id)).toBeInTheDocument()
        expect(screen.getByText(fixtureMovie.scope)).toBeInTheDocument()
        expect(screen.getByText('4 steps')).toBeInTheDocument()
        expect(screen.getByText('00:20')).toBeInTheDocument()
        expect(screen.getByText('1 bookmark')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Study' })).toHaveAttribute('href', `${moviePath}?view=study`)
        expect(screen.getByRole('link', { name: 'Theater' })).toHaveAttribute('aria-current', 'page')
    })

    it('offers the whole movie file as a download named after the folder', async () => {
        renderApp(moviePath)
        await findVideo(fixtureMovie.title)

        const download = screen.getByRole('link', { name: 'Download movie' })
        expect(download).toHaveAttribute('href', `/media/${fixtureMovie.id}/movie.mp4`)
        expect(download).toHaveAttribute('download', `${fixtureMovie.id}.mp4`)
    })

    it('downloads the captioned copy when there is one, while the player keeps the plain video', async () => {
        getMovie.mockResolvedValueOnce({
            movie: fixtureMovie,
            bookmarks: fixtureBookmarks,
            download: 'movie-captioned.mp4',
        })
        renderApp(moviePath)
        const video = await findVideo(fixtureMovie.title)

        const download = screen.getByRole('link', { name: 'Download movie' })
        expect(download).toHaveAttribute('href', `/media/${fixtureMovie.id}/movie-captioned.mp4`)
        expect(download).toHaveAttribute('download', `${fixtureMovie.id}.mp4`)
        expect(video.getAttribute('src')).toBe(`/media/${fixtureMovie.id}/movie.mp4`)
    })

    it('says so in the header while bookmarks cannot be saved', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        onTestFinished(() => error.mockRestore())
        saveBookmarks.mockRejectedValueOnce(new Error('disk full'))
        renderApp(moviePath)
        await findVideo(fixtureMovie.title)
        const bookmark = screen.getByRole('button', { name: /bookmark 1 /i })

        fireEvent.click(bookmark)

        expect(await screen.findByText("Couldn't save bookmarks")).toBeInTheDocument()
        expect(screen.getByText('1 bookmark')).toBeInTheDocument()
        expect(error).toHaveBeenCalledOnce()

        fireEvent.click(bookmark)

        await waitFor(() => expect(screen.queryByText("Couldn't save bookmarks")).not.toBeInTheDocument())
        expect(screen.getByText('2 bookmarks')).toBeInTheDocument()
    })

    it('loads a folder whose name has spaces, quotes and percent signs, and plays its video', async () => {
        const id = "it's 100% here"
        getMovie.mockResolvedValueOnce({ movie: fixtureMovie, bookmarks: fixtureBookmarks })

        renderApp(`/m/${encodeURIComponent(id)}`)
        const video = await findVideo(fixtureMovie.title)

        expect(getMovie).toHaveBeenLastCalledWith({ data: { id } })
        expect(video.getAttribute('src')).toBe("/media/it's%20100%25%20here/movie.mp4")
        const download = screen.getByRole('link', { name: 'Download movie' })
        expect(download.getAttribute('href')).toBe("/media/it's%20100%25%20here/movie.mp4")
        expect(download).toHaveAttribute('download', "it's 100% here.mp4")
        expect(screen.getByText(id)).toBeInTheDocument()
        expect(screen.queryByText(fixtureMovie.id)).not.toBeInTheDocument()
    })

    it('shows the ?at step in its very first render, before any effect runs', async () => {
        const router = createAppRouter(`${moviePath}?at=2f`)
        await router.load()

        const html = renderToString(<RouterProvider router={router as never} />)

        const caption = new DOMParser().parseFromString(html, 'text/html').querySelector('[aria-label="Caption"]')
        expect(caption?.textContent).toContain('2f · Keep archived = OFF')
    })

    it('renders the loader error for a movie that does not exist', async () => {
        expectLoaderError()
        renderApp('/m/nope')

        expect(await screen.findByText('no movie nope')).toBeInTheDocument()
    })

    it('names a broken bookmarks.json and its first issue', async () => {
        const bad = { version: 1, items: [{ code: 'zz', createdAt: '2026-11-03T11:00:00.000Z' }] }
        await serveFolder('it is broken', {
            'movie.json': JSON.stringify(fixtureMovie),
            'bookmarks.json': JSON.stringify(bad),
        })
        expectLoaderError()

        renderApp(`/m/${encodeURIComponent('it is broken')}`)

        expect(await screen.findByText(/^bookmarks\.json: items\.0\.code: Invalid string/)).toBeInTheDocument()
    })

    it('names a movie.json that is not valid JSON', async () => {
        await serveFolder('it is broken', { 'movie.json': '{ "version": 1, ' })
        expectLoaderError()

        renderApp(`/m/${encodeURIComponent('it is broken')}`)

        expect(await screen.findByText(/^movie\.json: \S/)).toBeInTheDocument()
    })

    it('refuses a movie without steps with a readable message', async () => {
        getMovie.mockResolvedValueOnce({ movie: { ...fixtureMovie, steps: [] }, bookmarks: fixtureBookmarks })
        expectLoaderError()

        renderApp(moviePath)

        expect(await screen.findByText(`${fixtureMovie.id} has no steps`)).toBeInTheDocument()
    })
})
