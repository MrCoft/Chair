import { z } from 'zod'
import { partSchema } from '../format/movie'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { SessionLike } from './session'

const MAX_RESULT_CHARS = 20000

type Content = CallToolResult['content']

function statusLine(session: SessionLike): string {
    const status = session.status()
    if (status.movie === null || status.step === null) return 'idle'
    return status.cut ? 'cut' : `filming: ${status.step}`
}

function truncate(text: string): string {
    return text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}… (truncated)` : text
}

export function registerTools(
    server: McpServer,
    session: SessionLike,
    takeWarnings: () => Array<string> = () => [],
): void {
    let queue: Promise<unknown> = Promise.resolve()

    function define<TShape extends z.ZodRawShape>(
        name: string,
        description: string,
        inputSchema: TShape,
        action: (args: z.infer<z.ZodObject<TShape>>) => Promise<Content> | Content,
    ): void {
        server.registerTool(name, { description, inputSchema }, ((args: z.infer<z.ZodObject<TShape>>) => {
            const turn = queue.then(async (): Promise<CallToolResult> => {
                try {
                    const content = await action(args)
                    return { content: [...content, { type: 'text', text: statusLine(session) }] }
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    return {
                        isError: true,
                        content: [
                            { type: 'text', text: message },
                            { type: 'text', text: statusLine(session) },
                        ],
                    }
                }
            })
            queue = turn
            return turn
        }) as never)
    }

    const text = (value: string): Content => [{ type: 'text', text: value }]

    define(
        'open',
        'Launch the browser and go to the start URL. Call this first, before rehearsing or filming. Use userDataDir (persistent profile) or storageState (saved login), not both. The camera stays off until movie_start and step.',
        {
            url: z.string(),
            channel: z.enum(['chromium', 'msedge', 'chrome']).optional(),
            userDataDir: z.string().optional(),
            storageState: z.string().optional(),
            viewport: z.object({ width: z.number().int(), height: z.number().int() }).optional(),
            headless: z.boolean().optional(),
            helpers: z.string().optional(),
            pacing: z
                .object({
                    markMs: z.number(),
                    cursorMs: z.number(),
                    typeDelayMs: z.number(),
                    afterMs: z.number(),
                })
                .partial()
                .optional(),
        },
        async (args) => text(await session.open(args)),
    )

    define(
        'run',
        'Run a Playwright snippet, a function expression like async (page, h) => { … }, with the helper library h loaded. Use it for rehearsal and for the take; the camera films only while a step is active and filming is not cut. Returns the snippet return value as JSON.',
        { code: z.string() },
        async ({ code }) => text(truncate(JSON.stringify((await session.run(code)) ?? null, null, 2))),
    )

    define(
        'snapshot',
        'Read the current page as an accessibility snapshot with URL and title. Use it to see the page, find selectors and recover from mistakes.',
        {},
        async () => text(await session.snapshot()),
    )

    define(
        'screenshot',
        'Take a PNG screenshot of the current page. Use it when the accessibility snapshot is not enough to see what is on screen.',
        {},
        async () => [{ type: 'image', mimeType: 'image/png', data: (await session.screenshot()).toString('base64') }],
    )

    define(
        'movie_start',
        'Begin a movie: output folder, title, scope and parts. Call it once per movie, after open and before the first step. The folder must be new or empty; movies are one-time. Leave id out: it defaults to the folder name, which is how the viewer and the copied bookmarks name the movie.',
        {
            dir: z.string().min(1),
            id: z.string().min(1).optional(),
            title: z.string(),
            scope: z.string(),
            parts: z.array(partSchema).min(1),
        },
        async (meta) => {
            const started = await session.movieStart(meta)
            return text(`Movie ${started.id} started in ${started.dir}`)
        },
    )

    define(
        'step',
        'End the current step and start the next one. Nothing is filmed until the next run, so start the actions with run straight away: the viewer stops at the start of each step until the human plays on, so never wait for them to read. Keep text to 1–3 short sentences; it is shown as the caption.',
        { code: z.string(), title: z.string(), text: z.string() },
        (args) => {
            session.step(args.code, args.title, args.text)
            return text(`Step ${args.code} started`)
        },
    )

    define(
        'cut',
        'Stop filming within the current step so you can repair state (inspect with snapshot, fix with run). Nothing is filmed until resume or retake; footage this step already has is kept — use retake to drop it, or resume to carry on.',
        {},
        () => {
            session.cut()
            return text('Filming stopped')
        },
    )

    define('resume', 'Start filming again after cut, continuing the current step.', {}, () => {
        session.resume()
        return text('Filming resumed')
    })

    define(
        'retake',
        'Discard everything filmed for a step (default: the current one) and make it current again; redo its actions with run. Use it after a mistake, usually after cut and a repair with run.',
        { code: z.string().optional() },
        ({ code }) => {
            session.retake(code)
            return text(`Retaking ${code ?? 'the current step'}`)
        },
    )

    define(
        'finish',
        'Close the last step, assemble the clips and movie.json, and open the viewer on the folder. Call it once when every step is filmed. The movie is then final.',
        { open: z.boolean().optional(), keepRaw: z.boolean().optional() },
        async (args) => {
            const movie = await session.finish(args)
            const lines = [`Finished movie ${movie.id}: ${movie.steps.length} steps`, ...takeWarnings()]
            return text(lines.join('\n'))
        },
    )

    define(
        'close',
        'Close the browser. Call it when all work is done. While a movie is still recording it refuses: call finish first, or pass discard: true to throw the unfinished movie and its frames away.',
        { discard: z.boolean().optional() },
        async (args) => {
            const discarded = await session.close(args)
            const lines = [
                ...(discarded === null ? [] : [`Discarded unfinished movie ${discarded}`]),
                'Browser closed',
                ...takeWarnings(),
            ]
            return text(lines.join('\n'))
        },
    )
}
