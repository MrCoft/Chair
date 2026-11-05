import { Link } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'

export const errorMessage = (error: unknown): string => {
    const message = error instanceof Error ? error.message : String(error)
    const firstLine = message
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line !== '')
    return firstLine ?? 'Something went wrong.'
}

export const MovieError = ({ error }: ErrorComponentProps) => (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-10">
        <h1 className="text-lg font-bold">Chair could not open this</h1>
        <p className="rounded-md border border-destructive/60 bg-destructive/10 px-4 py-3 font-mono text-sm break-words">
            {errorMessage(error)}
        </p>
        <Link to="/" className="text-primary underline-offset-4 hover:underline">
            All movies
        </Link>
    </main>
)
