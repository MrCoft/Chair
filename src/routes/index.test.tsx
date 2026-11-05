import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { expectLoaderError, findVideo, renderApp } from '@/test/renderApp'
import { getLibrary } from '@/test/serverMocks/movies'
import { fixtureMovie, fixtureRef } from '@/test/fixtures'

describe('the library route', () => {
    it('opens the only movie straight away and keeps ?at', async () => {
        const router = renderApp('/?at=2f')
        const video = await findVideo(fixtureMovie.title)

        expect(router.state.location.pathname).toBe(`/m/${fixtureMovie.id}`)
        await waitFor(() => expect(video.currentTime).toBe(12))
    })

    it('lists several movies with a link to each', async () => {
        const older = { ...fixtureRef, id: "it's older", title: 'Older take', steps: 1, durationMs: 65_000 }
        getLibrary.mockResolvedValueOnce({ dir: 'C:\\movies', refs: [fixtureRef, older], problems: [] })

        renderApp('/')

        expect(await screen.findByRole('link', { name: 'Older take' })).toHaveAttribute('href', "/m/it's%20older")
        expect(screen.getByRole('link', { name: fixtureMovie.title })).toHaveAttribute('href', `/m/${fixtureMovie.id}`)
        expect(screen.getByText('4 steps')).toBeInTheDocument()
        expect(screen.getByText('1 step')).toBeInTheDocument()
        expect(screen.getByText('01:05')).toBeInTheDocument()
    })

    it('says the folder has no movies and lists what was wrong', async () => {
        getLibrary.mockResolvedValueOnce({
            dir: "C:\\Projects\\it's here",
            refs: [],
            problems: ['broken: steps.0.code: Invalid string'],
        })

        renderApp('/')

        expect(await screen.findByText("No movies in C:\\Projects\\it's here")).toBeInTheDocument()
        expect(screen.getByText('broken: steps.0.code: Invalid string')).toBeInTheDocument()
    })

    it('shows a readable message when the folder cannot be read', async () => {
        getLibrary.mockRejectedValueOnce(new Error("ENOENT: no such file or directory, scandir 'C:\\nope'"))
        expectLoaderError()

        renderApp('/')

        expect(await screen.findByText("ENOENT: no such file or directory, scandir 'C:\\nope'")).toBeInTheDocument()
    })
})
