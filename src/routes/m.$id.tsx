import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import type { Movie } from '@/format/movie'
import { useBookmarks } from '@/bookmarks/useBookmarks'
import { Header } from '@/components/Header'
import { MovieError } from '@/components/MovieError'
import { Study } from '@/components/Study'
import { Theater } from '@/components/Theater'
import { PlayerProvider, usePlayer } from '@/player/PlayerContext'
import { useShortcuts } from '@/player/useShortcuts'
import { movieSearch } from '@/routes/-search'
import { getMovie } from '@/server/movies'

export const Route = createFileRoute('/m/$id')({
    validateSearch: movieSearch,
    loader: async ({ params }) => {
        const result = await getMovie({ data: { id: params.id } })
        if (result.movie.steps.length === 0) throw new Error(`${params.id} has no steps`)
        return result
    },
    head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `${loaderData.movie.title} · Chair` : 'Chair' }] }),
    component: MoviePage,
    errorComponent: MovieError,
})

function StartAt({ code }: { code: string | undefined }) {
    const { seekToStep } = usePlayer()
    useEffect(() => {
        if (code !== undefined) seekToStep(code)
    }, [code])
    return null
}

function Shortcuts(props: { movie: Movie; onBookmark: (code: string) => void }) {
    useShortcuts(props)
    return null
}

function MoviePage() {
    const { id } = Route.useParams()
    const { view, at } = Route.useSearch()
    const loaded = Route.useLoaderData()
    const { movie } = loaded
    const { bookmarks, saveFailed, toggle, note } = useBookmarks(id, loaded.bookmarks)
    const mediaSrc = (file: string) => `/media/${encodeURIComponent(id)}/${encodeURIComponent(file)}`
    const videoSrc = mediaSrc(movie.video)
    const downloadSrc = mediaSrc(loaded.download ?? movie.video)
    const initialMs = movie.steps.find((step) => step.code === at)?.startMs ?? 0

    return (
        <PlayerProvider key={id} movie={movie} initialMs={initialMs}>
            <StartAt code={at} />
            <Shortcuts movie={movie} onBookmark={toggle} />
            <div className="flex h-dvh flex-col">
                <Header
                    id={id}
                    movie={movie}
                    bookmarks={bookmarks}
                    saveFailed={saveFailed}
                    view={view}
                    downloadSrc={downloadSrc}
                />
                {view === 'study' ? (
                    <Study
                        movie={movie}
                        bookmarks={bookmarks}
                        videoSrc={videoSrc}
                        onToggleBookmark={toggle}
                        onNote={note}
                    />
                ) : (
                    <Theater movie={movie} bookmarks={bookmarks} videoSrc={videoSrc} onToggleBookmark={toggle} />
                )}
            </div>
        </PlayerProvider>
    )
}
