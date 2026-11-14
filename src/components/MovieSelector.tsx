import { Link, useNavigate } from '@tanstack/react-router'
import type { View } from './Header'
import type { MovieRef } from '@/server/library.server'

export function MovieSelector({
    id,
    title,
    view,
    refs,
}: {
    id: string
    title: string
    view: View
    refs: Array<MovieRef> | undefined
}) {
    const navigate = useNavigate()
    return (
        <div className="flex min-w-0 items-center gap-2">
            <label className="flex min-w-0 items-center gap-2">
                Movie
                <select
                    aria-label="Movie"
                    value={id}
                    className="max-w-64 min-w-0 rounded-md border border-input bg-background px-2 py-1 text-foreground"
                    onChange={(event) => {
                        void navigate({ to: '/m/$id', params: { id: event.target.value }, search: { view } })
                    }}
                >
                    {!refs?.some((ref) => ref.id === id) && (
                        <option value={id}>
                            {title} · {id}
                        </option>
                    )}
                    {refs?.map((ref) => (
                        <option key={ref.id} value={ref.id}>
                            {ref.title} · {ref.id}
                        </option>
                    ))}
                </select>
            </label>
            <Link to="/" className="shrink-0 text-primary underline-offset-4 hover:underline">
                All movies
            </Link>
            {refs === undefined && (
                <span role="status" className="text-muted-foreground">
                    Movie list unavailable
                </span>
            )}
        </div>
    )
}
