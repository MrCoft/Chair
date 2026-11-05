import { mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { CDPSession, Page } from 'playwright'
import type { Frame } from './timeline'

type ScreencastFrame = {
    data: string
    sessionId: number
    metadata: { timestamp?: number }
}

export class Camera {
    private session: CDPSession | null = null
    private counter = 0
    private pending = new Set<Promise<void>>()

    constructor(
        private readonly page: Page,
        private readonly framesDir: string,
        private readonly onFrame: (f: Frame) => void,
        private readonly shouldKeep: () => boolean,
    ) {}

    private nextFile(): string {
        this.counter += 1
        return resolve(this.framesDir, `f${String(this.counter).padStart(6, '0')}.jpg`)
    }

    async start(): Promise<void> {
        if (this.session) return
        mkdirSync(this.framesDir, { recursive: true })
        const session = await this.page.context().newCDPSession(this.page)
        session.on('Page.screencastFrame', (event: ScreencastFrame) => {
            session.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => undefined)
            if (!this.shouldKeep()) return
            const file = this.nextFile()
            const ts = (event.metadata.timestamp ?? Date.now() / 1000) * 1000
            const tracked: Promise<void> = writeFile(file, Buffer.from(event.data, 'base64'))
                .then(() => {
                    this.onFrame({ file, ts })
                })
                .catch(() => undefined)
                .finally(() => this.pending.delete(tracked))
            this.pending.add(tracked)
        })
        const viewport = this.page.viewportSize()
        try {
            await session.send('Page.startScreencast', {
                format: 'jpeg',
                quality: 80,
                ...(viewport ? { maxWidth: viewport.width, maxHeight: viewport.height } : {}),
            })
        } catch (error) {
            await session.detach().catch(() => undefined)
            throw error
        }
        this.session = session
    }

    async flush(): Promise<void> {
        await Promise.allSettled([...this.pending])
    }

    async stop(): Promise<void> {
        const session = this.session
        if (!session) return
        this.session = null
        await session.send('Page.stopScreencast').catch(() => undefined)
        await this.flush()
        await session.detach().catch(() => undefined)
    }

    async snapshotFrame(): Promise<Frame> {
        mkdirSync(this.framesDir, { recursive: true })
        const file = this.nextFile()
        const ts = Date.now()
        await this.page.screenshot({ type: 'jpeg', path: file })
        const frame = { file, ts }
        this.onFrame(frame)
        return frame
    }
}
