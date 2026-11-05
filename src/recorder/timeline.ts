import { STEP_CODE, partOf } from '../format/movie'
import type { Part } from '../format/movie'

export type Frame = { file: string; ts: number }
export type Segment = { startMs: number; endMs: number; frames: Array<Frame> }
export type LoggedAction = { kind: string; target?: string; ts: number }
export type StepDraft = {
    code: string
    title: string
    text: string
    segments: Array<Segment>
    actions: Array<LoggedAction>
}

export class TimelineError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'TimelineError'
    }
}

export class Timeline {
    private readonly partCodes: Set<string>
    private readonly steps = new Map<string, StepDraft>()
    private current: StepDraft | null = null
    private open: Segment | null = null
    private cutting = false

    constructor(parts: Array<Part>) {
        this.partCodes = new Set(parts.map((part) => part.code))
    }

    get currentCode(): string | null {
        return this.current?.code ?? null
    }

    get isCut(): boolean {
        return this.cutting
    }

    get isFilming(): boolean {
        return this.open !== null
    }

    startStep(code: string, title: string, text: string): void {
        this.assertClosed()
        if (!STEP_CODE.test(code)) throw new TimelineError(`invalid step code ${code}`)
        const part = partOf(code)
        if (!this.partCodes.has(part)) throw new TimelineError(`unknown part ${part}`)
        if (this.steps.has(code)) throw new TimelineError(`step ${code} already exists — use retake('${code}')`)
        const draft: StepDraft = { code, title, text, segments: [], actions: [] }
        this.steps.set(code, draft)
        this.current = draft
        this.cutting = false
    }

    retake(code?: string): void {
        this.assertClosed()
        const current = this.requireCurrent()
        const target = code === undefined ? current : this.steps.get(code)
        if (!target) throw new TimelineError(`no step ${code} to retake`)
        target.segments = []
        target.actions = []
        this.current = target
        this.cutting = false
    }

    cut(): void {
        this.assertClosed()
        this.requireCurrent()
        this.cutting = true
    }

    resume(): void {
        this.cutting = false
    }

    openSegment(now: number): boolean {
        this.requireCurrent()
        this.assertClosed()
        if (this.cutting) return false
        this.open = { startMs: now, endMs: now, frames: [] }
        return true
    }

    closeSegment(now: number): void {
        if (!this.open || !this.current) return
        this.open.endMs = now
        this.current.segments.push(this.open)
        this.open = null
    }

    addFrame(frame: Frame): void {
        this.open?.frames.push(frame)
    }

    logAction(kind: string, target: string | undefined, now: number): void {
        if (!this.open || !this.current) return
        this.current.actions.push({ kind, target, ts: now })
    }

    keptSteps(): Array<StepDraft> {
        return [...this.steps.values()].filter((step) => step.segments.length > 0)
    }

    private requireCurrent(): StepDraft {
        if (!this.current) throw new TimelineError('no step started — call step first')
        return this.current
    }

    private assertClosed(): void {
        if (this.open) throw new TimelineError('segment already open')
    }
}
