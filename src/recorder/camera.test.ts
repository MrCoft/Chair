import { EventEmitter } from 'node:events'
import { readdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it, vi } from 'vitest'
import { Camera } from './camera'
import type { Page } from 'playwright'
import type { Frame } from './timeline'

function fakeCdp(o: { failStart?: boolean } = {}) {
    const events = new EventEmitter()
    const session = {
        on(event: string, listener: (payload: unknown) => void) {
            events.on(event, listener)
            return session
        },
        send: vi.fn((method: string) =>
            o.failStart === true && method === 'Page.startScreencast'
                ? Promise.reject(new Error('Target closed'))
                : Promise.resolve({}),
        ),
        detach: vi.fn(() => Promise.resolve()),
    }
    let sessionId = 0
    const frame = () => {
        sessionId += 1
        events.emit('Page.screencastFrame', {
            data: Buffer.from(`jpeg ${sessionId}`).toString('base64'),
            sessionId,
            metadata: { timestamp: 1000 + sessionId },
        })
    }
    const acks = () => session.send.mock.calls.filter(([method]) => method === 'Page.screencastFrameAck').length
    return { session, frame, acks }
}

function fakePage(...sessions: Array<ReturnType<typeof fakeCdp>['session']>) {
    const newCDPSession = vi.fn()
    for (const session of sessions) newCDPSession.mockResolvedValueOnce(session)
    const page = { context: () => ({ newCDPSession }), viewportSize: () => ({ width: 800, height: 600 }) }
    return { page: page as unknown as Page, newCDPSession }
}

const freshDir = (name: string) => {
    const dir = resolve('test-output', 'camera-unit', name)
    rmSync(dir, { recursive: true, force: true })
    return dir
}

it('acks every frame but writes only the ones being filmed', async () => {
    const cdp = fakeCdp()
    const { page } = fakePage(cdp.session)
    const dir = freshDir("it's kept")
    const frames: Array<Frame> = []
    let filming = false
    const camera = new Camera(
        page,
        dir,
        (f) => frames.push(f),
        () => filming,
    )
    await camera.start()

    cdp.frame()
    filming = true
    cdp.frame()
    filming = false
    cdp.frame()
    await camera.flush()

    expect(cdp.acks()).toBe(3)
    expect(readdirSync(dir)).toEqual(['f000001.jpg'])
    expect(frames).toEqual([{ file: resolve(dir, 'f000001.jpg'), ts: 1_002_000 }])
})

it('a camera whose screencast failed to start can be started again', async () => {
    const failing = fakeCdp({ failStart: true })
    const working = fakeCdp()
    const { page, newCDPSession } = fakePage(failing.session, working.session)
    const camera = new Camera(
        page,
        freshDir("it's restarted"),
        () => undefined,
        () => true,
    )

    await expect(camera.start()).rejects.toThrow('Target closed')
    expect(failing.session.detach).toHaveBeenCalled()
    await camera.start()
    expect(newCDPSession).toHaveBeenCalledTimes(2)
    expect(working.session.send).toHaveBeenCalledWith('Page.startScreencast', expect.anything())
})
