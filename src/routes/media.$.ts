import { createFileRoute } from '@tanstack/react-router'
import { mediaHandler } from '../server/range'

export const Route = createFileRoute('/media/$')({
    server: {
        handlers: {
            GET: async ({ params, request }) => mediaHandler(process.env.CHAIR_DIR, params._splat ?? '', request),
        },
    },
})
