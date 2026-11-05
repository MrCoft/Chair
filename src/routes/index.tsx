import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { MovieError } from '@/components/MovieError'
import { formatTime } from '@/player/timeline'
import { librarySearch } from '@/routes/-search'
import { getLibrary } from '@/server/movies'

export const Route = createFileRoute('/')({
    validateSearch: librarySearch,
    loaderDeps: ({ search }) => ({ at: search.at }),
    loader: async ({ deps }) => {
        const library = await getLibrary()
        if (library.refs.length === 1) {
            throw redirect({ to: '/m/$id', params: { id: library.refs[0].id }, search: { at: deps.at } })
        }
        return library
    },
    component: LibraryPage,
    errorComponent: MovieError,
})

const pad = (n: number) => String(n).padStart(2, '0')

const formatDate = (iso: string): string => {
    const date = new Date(iso)
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function LibraryPage() {
    const { dir, refs, problems } = Route.useLoaderData()

    return (
        <main className="mx-auto flex max-w-3xl flex-col gap-6 p-10">
            <h1 className="text-lg font-bold">{refs.length === 0 ? `No movies in ${dir}` : `Movies in ${dir}`}</h1>
            {refs.length > 0 && (
                <ul className="flex flex-col gap-2">
                    {refs.map((ref) => (
                        <li key={ref.id} className="rounded-md border bg-card px-4 py-3">
                            <Link
                                to="/m/$id"
                                params={{ id: ref.id }}
                                className="font-semibold text-primary underline-offset-4 hover:underline"
                            >
                                {ref.title}
                            </Link>
                            <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                                <span>{ref.scope}</span>
                                <span>{formatDate(ref.createdAt)}</span>
                                <span>{`${ref.steps} ${ref.steps === 1 ? 'step' : 'steps'}`}</span>
                                <span>{formatTime(ref.durationMs)}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            {problems.length > 0 && (
                <section aria-label="Problems" className="flex flex-col gap-2">
                    <h2 className="text-sm font-semibold text-muted-foreground">Folders that could not be read</h2>
                    <ul className="flex flex-col gap-1 font-mono text-sm">
                        {problems.map((problem) => (
                            <li key={problem}>{problem}</li>
                        ))}
                    </ul>
                </section>
            )}
        </main>
    )
}
