import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { z } from 'zod'
import { spawnDetachedView } from '../cli/spawn'
import { DEFAULT_PACING, createHelpers } from '../effects/helpers'
import { OVERLAY_SCRIPT } from '../effects/overlay'
import { movieSchema, partSchema } from '../format/movie'
import { finishMovie } from '../recorder/assemble'
import { Camera } from '../recorder/camera'
import { exportCaptioned } from '../recorder/captions'
import { Timeline, TimelineError } from '../recorder/timeline'
import type { BrowserContext, Page } from 'playwright'
import type { Helpers, Pacing } from '../effects/helpers'
import type { Movie } from '../format/movie'
import type { MovieMeta } from '../recorder/assemble'
import type { Frame } from '../recorder/timeline'

export type OpenOptions = {
    url: string
    channel?: 'chromium' | 'msedge' | 'chrome'
    userDataDir?: string
    storageState?: string
    viewport?: { width: number; height: number }
    headless?: boolean
    helpers?: string
    pacing?: Partial<Pacing>
}

export type LaunchSettings = Required<Pick<OpenOptions, 'url' | 'channel' | 'viewport' | 'headless'>> &
    Pick<OpenOptions, 'userDataDir' | 'storageState'>
export type Launched = { page: Page; close: () => Promise<void> }
export type CameraLike = Pick<Camera, 'start' | 'stop' | 'flush' | 'snapshotFrame'>
export type SessionDeps = {
    launch: (settings: LaunchSettings) => Promise<Launched>
    camera: (page: Page, framesDir: string, onFrame: (frame: Frame) => void, shouldKeep: () => boolean) => CameraLike
    finish: typeof finishMovie
    caption: (dir: string) => Promise<string>
    warn: (message: string) => void
}

type SessionHelpers = Helpers & Record<string, unknown>
type Snippet = (page: Page, h: SessionHelpers) => unknown
type PackFactory = (page: Page, h: SessionHelpers) => unknown
type OpenBrowser = Launched & { h: SessionHelpers }
type Recording = { meta: MovieMeta; timeline: Timeline; camera: CameraLike }
export type MovieStart = Omit<MovieMeta, 'id'> & { id?: string }

export class SessionError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'SessionError'
    }
}

const DEFAULT_VIEWPORT = { width: 1600, height: 900 }
const FUNCTION_HINT = 'code must be a function expression like async (page, h) => { … }'

const metaSchema = z.object({
    dir: z.string().min(1),
    id: z.string().min(1).optional(),
    title: z.string(),
    scope: z.string(),
    parts: z.array(partSchema).min(1),
})

function canRecordInto(dir: string): boolean {
    if (!existsSync(dir)) return true
    const entries = readdirSync(dir)
    if (entries.length === 0) return true
    return entries.length === 1 && entries[0] === 'raw' && existsSync(join(dir, 'raw', 'frames'))
}

function guard<T>(action: () => T): T {
    try {
        return action()
    } catch (error) {
        if (error instanceof TimelineError) throw new SessionError(error.message)
        throw error
    }
}

function parseSnippet(code: string): Snippet {
    let value: unknown
    try {
        value = new Function(`return (\n${code.trim().replace(/;$/, '')}\n)`)()
    } catch (error) {
        throw new SessionError(`${FUNCTION_HINT} — ${String(error)}`)
    }
    if (typeof value !== 'function') throw new SessionError(FUNCTION_HINT)
    return value as Snippet
}

let packLoads = 0

async function loadPack(path: string): Promise<PackFactory> {
    packLoads += 1
    const url = `${pathToFileURL(resolve(path)).href}?load=${packLoads}`
    const loaded = (await import(url)) as { default?: unknown }
    if (typeof loaded.default !== 'function') {
        throw new SessionError(`helper pack ${path} must default-export a function (page, h) => ({ … })`)
    }
    return loaded.default as PackFactory
}

async function launchBrowser(settings: LaunchSettings): Promise<Launched> {
    const channel = settings.channel === 'chromium' ? undefined : settings.channel
    let context: BrowserContext
    let close: () => Promise<void>
    if (settings.userDataDir !== undefined) {
        const persistent = await chromium.launchPersistentContext(settings.userDataDir, {
            channel,
            headless: settings.headless,
            viewport: settings.viewport,
        })
        context = persistent
        close = () => persistent.close()
    } else {
        const browser = await chromium.launch({ channel, headless: settings.headless })
        close = () => browser.close()
        context = await browser.newContext({ viewport: settings.viewport, storageState: settings.storageState })
    }
    try {
        await context.addInitScript(OVERLAY_SCRIPT)
        const page = context.pages()[0] ?? (await context.newPage())
        await page.goto(settings.url)
        return { page, close }
    } catch (error) {
        await close().catch(() => undefined)
        throw error
    }
}

const defaultDeps: SessionDeps = {
    launch: launchBrowser,
    camera: (page, framesDir, onFrame, shouldKeep) => new Camera(page, framesDir, onFrame, shouldKeep),
    finish: finishMovie,
    caption: (dir) => exportCaptioned(dir),
    warn: (message) => console.warn(message),
}

export class ChairSession {
    private readonly deps: SessionDeps
    private browser: OpenBrowser | null = null
    private recording: Recording | null = null

    constructor(deps: Partial<SessionDeps> = {}) {
        this.deps = { ...defaultDeps, ...deps }
    }

    async open(o: OpenOptions): Promise<string> {
        if (this.browser) throw new SessionError('browser already open — call close first')
        if (o.userDataDir !== undefined && o.storageState !== undefined) {
            throw new SessionError('use either userDataDir or storageState, not both')
        }
        const pack = o.helpers === undefined ? undefined : await loadPack(o.helpers)
        const settings: LaunchSettings = {
            url: o.url,
            channel: o.channel ?? 'chromium',
            viewport: o.viewport ?? DEFAULT_VIEWPORT,
            headless: o.headless ?? true,
            userDataDir: o.userDataDir,
            storageState: o.storageState,
        }
        const launched = await this.deps.launch(settings)
        try {
            const h = await this.buildHelpers(launched.page, { ...DEFAULT_PACING, ...o.pacing }, pack, o.helpers)
            this.browser = { ...launched, h }
        } catch (error) {
            await launched.close().catch(() => undefined)
            throw error
        }
        const { width, height } = settings.viewport
        const mode = settings.headless ? ', headless' : ''
        return `Opened ${launched.page.url()} (${settings.channel}, ${width}×${height}${mode}). h: ${Object.keys(this.browser.h).join(', ')}`
    }

    async run(code: string): Promise<unknown> {
        const { page, h } = this.requireBrowser()
        const snippet = parseSnippet(code)
        return this.film(() => Promise.resolve(snippet(page, h)))
    }

    async snapshot(): Promise<string> {
        const { page } = this.requireBrowser()
        const aria = await page.locator('body').ariaSnapshot()
        return `URL: ${page.url()}\nTitle: ${await page.title()}\n\n${aria}`
    }

    async screenshot(): Promise<Buffer> {
        return this.requireBrowser().page.screenshot({ type: 'png' })
    }

    async movieStart(m: MovieStart): Promise<MovieMeta> {
        const { page } = this.requireBrowser()
        if (this.recording) {
            throw new SessionError(`movie ${this.recording.meta.id} is still being recorded — call finish first`)
        }
        const parsed = metaSchema.safeParse(m)
        if (!parsed.success) throw new SessionError(`invalid movie: ${z.prettifyError(parsed.error)}`)
        const dir = resolve(parsed.data.dir)
        const meta: MovieMeta = { ...parsed.data, dir, id: parsed.data.id ?? basename(dir) }
        if (existsSync(join(meta.dir, 'movie.json'))) {
            throw new SessionError(
                `movie folder already finished: ${meta.dir} — movies are one-time, choose a new folder`,
            )
        }
        if (!canRecordInto(meta.dir)) {
            throw new SessionError(`movie folder is not empty: ${meta.dir} — choose a new folder`)
        }
        const timeline = new Timeline(meta.parts)
        const framesDir = join(meta.dir, 'raw', 'frames')
        mkdirSync(framesDir, { recursive: true })
        const camera = this.deps.camera(
            page,
            framesDir,
            (frame) => timeline.addFrame(frame),
            () => timeline.isFilming,
        )
        await camera.start()
        this.recording = { meta, timeline, camera }
        return meta
    }

    step(code: string, title: string, text: string): void {
        const { timeline } = this.requireRecording()
        guard(() => timeline.startStep(code, title, text))
    }

    cut(): void {
        const { timeline } = this.requireRecording()
        guard(() => timeline.cut())
    }

    resume(): void {
        this.requireRecording().timeline.resume()
    }

    retake(code?: string): void {
        const { timeline } = this.requireRecording()
        guard(() => timeline.retake(code))
    }

    async finish(o: { open?: boolean; keepRaw?: boolean } = {}): Promise<Movie> {
        const recording = this.requireRecording()
        const steps = recording.timeline.keptSteps()
        if (steps.length === 0) throw new SessionError('nothing was filmed — record at least one step')
        await recording.camera.stop()
        let movie: Movie
        try {
            movie = await this.deps.finish({ meta: recording.meta, steps, keepRaw: o.keepRaw ?? false })
        } catch (error) {
            movie = await this.recoverFromFailedFinish(recording, error)
        }
        this.recording = null
        await this.deps.caption(recording.meta.dir).catch((error: unknown) => {
            this.deps.warn(
                `the captioned copy for downloads was not made (${String(error)}) — run chair export "${recording.meta.dir}"`,
            )
        })
        if (o.open !== false) {
            const problem = spawnDetachedView(recording.meta.dir)
            if (problem !== null) this.deps.warn(problem)
        }
        return movie
    }

    async close(o: { discard?: boolean } = {}): Promise<string | null> {
        const { browser, recording } = this
        if (recording && o.discard !== true) {
            throw new SessionError(
                'a movie is still recording — call finish, or close({ discard: true }) to throw it away',
            )
        }
        this.browser = null
        this.recording = null
        try {
            await recording?.camera.stop()
            await browser?.close()
        } finally {
            if (recording) await this.removeRaw(recording.meta.dir)
        }
        return recording?.meta.id ?? null
    }

    status(): { browser: boolean; movie: string | null; step: string | null; cut: boolean } {
        const timeline = this.recording?.timeline
        return {
            browser: this.browser !== null,
            movie: this.recording?.meta.id ?? null,
            step: timeline?.currentCode ?? null,
            cut: timeline?.isCut ?? false,
        }
    }

    private async buildHelpers(
        page: Page,
        pacing: Pacing,
        pack: PackFactory | undefined,
        packPath: string | undefined,
    ): Promise<SessionHelpers> {
        const builtins = createHelpers(
            page,
            (kind, target) => this.recording?.timeline.logAction(kind, target, Date.now()),
            pacing,
        )
        const h: SessionHelpers = { ...builtins }
        if (!pack) return h
        const extras = await pack(page, h)
        if (typeof extras !== 'object' || extras === null) {
            throw new SessionError(`helper pack ${packPath} must return an object of helpers`)
        }
        const clash = Object.keys(extras).find((name) => Object.hasOwn(builtins, name))
        if (clash !== undefined) throw new SessionError(`helper pack overrides built-in h.${clash}`)
        return Object.assign(h, extras)
    }

    private async removeRaw(dir: string): Promise<void> {
        const raw = join(dir, 'raw')
        await rm(raw, { recursive: true, force: true, maxRetries: 3 }).catch((error: unknown) => {
            this.deps.warn(`${raw} was not removed (${String(error)}) — delete it by hand`)
        })
    }

    private async recoverFromFailedFinish(recording: Recording, error: unknown): Promise<Movie> {
        const { meta, camera } = recording
        const manifest = join(meta.dir, 'movie.json')
        if (!existsSync(manifest)) {
            await camera.start().catch((restart: unknown) => {
                this.deps.warn(`the camera did not restart after the failed finish: ${String(restart)}`)
            })
            throw error
        }
        this.recording = null
        const raw = join(meta.dir, 'raw')
        this.deps.warn(
            `movie ${meta.id} is finished, but ${raw} was not removed (${String(error)}) — delete it by hand`,
        )
        return movieSchema.parse(JSON.parse(readFileSync(manifest, 'utf8')))
    }

    private async film<T>(work: () => Promise<T>): Promise<T> {
        const recording = this.recording
        if (!recording || recording.timeline.currentCode === null) return work()
        if (!guard(() => recording.timeline.openSegment(Date.now()))) return work()
        try {
            await recording.camera.snapshotFrame()
            return await work()
        } finally {
            const end = Date.now()
            await recording.camera.flush()
            recording.timeline.closeSegment(end)
        }
    }

    private requireBrowser(): OpenBrowser {
        if (!this.browser) throw new SessionError('call open first')
        return this.browser
    }

    private requireRecording(): Recording {
        this.requireBrowser()
        if (!this.recording) throw new SessionError('call movie_start first')
        return this.recording
    }
}

export type SessionLike = Pick<
    ChairSession,
    | 'open'
    | 'run'
    | 'snapshot'
    | 'screenshot'
    | 'movieStart'
    | 'step'
    | 'cut'
    | 'resume'
    | 'retake'
    | 'finish'
    | 'close'
    | 'status'
>
