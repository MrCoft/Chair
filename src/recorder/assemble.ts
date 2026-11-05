import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { emptyBookmarks, movieSchema, partOf } from '../format/movie'
import { encodeMovie, layoutFrames } from './encode'
import type { Movie, Part } from '../format/movie'
import type { StepDraft } from './timeline'

export type MovieMeta = { dir: string; id: string; title: string; scope: string; parts: Array<Part> }

const VIDEO = 'movie.mp4'

const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n'

export async function finishMovie(o: {
    meta: MovieMeta
    steps: Array<StepDraft>
    keepRaw: boolean
    ffmpegPath?: string
    now?: Date
}): Promise<Movie> {
    const { meta } = o
    const layout = layoutFrames(o.steps)
    if (layout.concat === '') throw new Error('nothing was filmed — record at least one step')

    const movie = movieSchema.parse({
        version: 1,
        id: meta.id,
        title: meta.title,
        scope: meta.scope,
        createdAt: (o.now ?? new Date()).toISOString(),
        video: VIDEO,
        durationMs: layout.totalMs,
        parts: meta.parts,
        steps: o.steps.map((draft, index) => {
            const laid = layout.steps[index]
            return {
                code: draft.code,
                part: partOf(draft.code),
                title: draft.title,
                text: draft.text,
                startMs: laid.startMs,
                durationMs: laid.durationMs,
                actions: laid.actions,
            }
        }),
    })

    const raw = join(meta.dir, 'raw')
    await mkdir(raw, { recursive: true })
    const concatFile = join(raw, 'concat.txt')
    await writeFile(concatFile, layout.concat)
    await encodeMovie(concatFile, join(meta.dir, VIDEO), o.ffmpegPath)

    await writeFile(join(meta.dir, 'bookmarks.json'), json(emptyBookmarks()))
    await writeFile(join(meta.dir, 'movie.json'), json(movie))
    if (!o.keepRaw) await rm(raw, { recursive: true, force: true, maxRetries: 3 })
    return movie
}
