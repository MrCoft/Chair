import { z } from 'zod'

export const PART_CODE = /^[1-9]\d*$/
export const STEP_CODE = /^[1-9]\d*[a-z]?$/

export const CAPTIONED_VIDEO = 'movie-captioned.mp4'

export const partOf = (code: string): string => code.replace(/[a-z]$/, '')

export const actionSchema = z.object({
    kind: z.string().min(1),
    target: z.string().optional(),
    atMs: z.number().min(0),
})

export const partSchema = z.object({
    code: z.string().regex(PART_CODE),
    title: z.string(),
})

export const stepSchema = z.object({
    code: z.string().regex(STEP_CODE),
    part: z.string().regex(PART_CODE),
    title: z.string(),
    text: z.string(),
    startMs: z.number().min(0),
    durationMs: z.number().min(0),
    actions: z.array(actionSchema),
})

export const movieSchema = z
    .object({
        version: z.literal(1),
        id: z.string().min(1),
        title: z.string(),
        scope: z.string(),
        createdAt: z.iso.datetime(),
        video: z.string().min(1),
        durationMs: z.number().min(0),
        parts: z.array(partSchema),
        steps: z.array(stepSchema),
    })
    .superRefine((movie, ctx) => {
        const partCodes = new Set(movie.parts.map((part) => part.code))
        const seen = new Set<string>()
        let cursor = 0

        movie.steps.forEach((step, index) => {
            const path = ['steps', index]
            if (seen.has(step.code)) {
                ctx.addIssue({ code: 'custom', path, message: `duplicate step code ${step.code}` })
            }
            seen.add(step.code)

            const expectedPart = partOf(step.code)
            if (step.part !== expectedPart) {
                ctx.addIssue({ code: 'custom', path, message: `step ${step.code} belongs to part ${expectedPart}` })
            }
            if (!partCodes.has(step.part)) {
                ctx.addIssue({ code: 'custom', path, message: `step ${step.code} has unknown part ${step.part}` })
            }

            if (step.startMs !== cursor) {
                ctx.addIssue({ code: 'custom', path, message: `step ${step.code} must start at ${cursor}` })
            }
            cursor = step.startMs + step.durationMs
        })

        if (movie.steps.length > 0 && cursor !== movie.durationMs) {
            ctx.addIssue({
                code: 'custom',
                path: ['durationMs'],
                message: `the last step ends at ${cursor}, but the movie lasts ${movie.durationMs}`,
            })
        }
    })

export const bookmarkSchema = z.object({
    code: z.string().regex(STEP_CODE),
    note: z.string().optional(),
    createdAt: z.iso.datetime(),
})

export const bookmarksSchema = z.object({
    version: z.literal(1),
    items: z.array(bookmarkSchema),
})

export type Action = z.infer<typeof actionSchema>
export type Part = z.infer<typeof partSchema>
export type Step = z.infer<typeof stepSchema>
export type Movie = z.infer<typeof movieSchema>
export type Bookmark = z.infer<typeof bookmarkSchema>
export type Bookmarks = z.infer<typeof bookmarksSchema>

export const emptyBookmarks = (): Bookmarks => ({ version: 1, items: [] })
