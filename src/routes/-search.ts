import { stringifySearchWith } from '@tanstack/react-router'
import { z } from 'zod'

const stepCode = z.union([z.string(), z.number()]).transform(String).optional().catch(undefined)

export const stringifySearch = stringifySearchWith(JSON.stringify)

export const librarySearch = z.object({ at: stepCode })

export const movieSearch = z.object({
    view: z.enum(['theater', 'study']).default('theater').catch('theater'),
    at: stepCode,
})
