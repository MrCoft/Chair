import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it, vi } from 'vitest'
import { fixtureMovie } from '../test/fixtures'
import { SessionError } from './session'
import { registerTools } from './tools'
import type { SessionLike } from './session'

type Status = ReturnType<SessionLike['status']>

function idleStatus(): Status {
    return { browser: true, movie: null, step: null, cut: false }
}

function fakeSession(overrides: Partial<SessionLike> = {}, status: Status = idleStatus()): SessionLike {
    return {
        open: vi.fn(() => Promise.resolve('opened')),
        run: vi.fn(() => Promise.resolve({ ok: true })),
        snapshot: vi.fn(() => Promise.resolve('snap')),
        screenshot: vi.fn(() => Promise.resolve(Buffer.from('png-bytes'))),
        movieStart: vi.fn((meta: Parameters<SessionLike['movieStart']>[0]) =>
            Promise.resolve({ ...meta, id: meta.id ?? 'folder' }),
        ),
        step: vi.fn(),
        cut: vi.fn(),
        resume: vi.fn(),
        retake: vi.fn(),
        finish: vi.fn(() => Promise.resolve(fixtureMovie)),
        close: vi.fn(() => Promise.resolve<string | null>(null)),
        status: () => status,
        ...overrides,
    }
}

async function connect(session: SessionLike, takeWarnings?: () => Array<string>) {
    const server = new McpServer({ name: 'chair', version: '0.0.0' })
    registerTools(server, session, takeWarnings)
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
    const client = new Client({ name: 'test', version: '0.0.0' })
    await Promise.all([server.connect(serverSide), client.connect(clientSide)])
    return client
}

function textOf(result: Awaited<ReturnType<Client['callTool']>>): string {
    const content = result.content as Array<{ type: string; text?: string }>
    return content.map((c) => c.text ?? '').join('\n')
}

const lastLine = (text: string) => text.split('\n').at(-1)

describe('chair MCP tools', () => {
    it('lists exactly the eleven tools', async () => {
        const client = await connect(fakeSession())
        const { tools } = await client.listTools()
        expect(tools.map((t) => t.name).sort()).toEqual(
            [
                'close',
                'cut',
                'finish',
                'movie_start',
                'open',
                'resume',
                'retake',
                'run',
                'screenshot',
                'snapshot',
                'step',
            ].sort(),
        )
        for (const tool of tools) expect(tool.description).toBeTruthy()
    })

    it('describes cut, close and movie_start the way they behave', async () => {
        const client = await connect(fakeSession())
        const { tools } = await client.listTools()
        const tool = (name: string) => tools.find((t) => t.name === name)
        expect(tool('cut')?.description).toContain('footage this step already has is kept — use retake to drop it')
        expect(tool('close')?.inputSchema.properties).toHaveProperty('discard')
        expect(tool('close')?.description).toContain('discard')
        expect(tool('movie_start')?.inputSchema.required).not.toContain('id')
    })

    it('close names the movie it discarded', async () => {
        const session = fakeSession({ close: vi.fn(() => Promise.resolve('m')) })
        const client = await connect(session, () => ['raw/ was left behind'])
        const result = await client.callTool({ name: 'close', arguments: { discard: true } })
        expect(session.close).toHaveBeenCalledWith({ discard: true })
        const lines = textOf(result).split('\n')
        expect(lines.slice(0, 3)).toEqual(['Discarded unfinished movie m', 'Browser closed', 'raw/ was left behind'])
    })

    it('close without a movie just closes the browser', async () => {
        const client = await connect(fakeSession())
        const result = await client.callTool({ name: 'close', arguments: {} })
        expect(textOf(result).split('\n')[0]).toBe('Browser closed')
    })

    it('a SessionError becomes an isError result', async () => {
        const session = fakeSession({
            step: vi.fn(() => {
                throw new SessionError('call movie_start first')
            }),
        })
        const client = await connect(session)
        const result = await client.callTool({ name: 'step', arguments: { code: '1a', title: 'T', text: 'x' } })
        expect(result.isError).toBe(true)
        expect(textOf(result)).toContain('call movie_start first')
    })

    it('screenshot returns an image', async () => {
        const client = await connect(fakeSession())
        const result = await client.callTool({ name: 'screenshot', arguments: {} })
        const content = result.content as Array<{ type: string; mimeType?: string; data?: string }>
        expect(content[0]).toMatchObject({ type: 'image', mimeType: 'image/png' })
        expect(content[0]?.data).toBe(Buffer.from('png-bytes').toString('base64'))
    })

    it('run truncates long results', async () => {
        const session = fakeSession({ run: vi.fn(() => Promise.resolve('x'.repeat(30000))) })
        const client = await connect(session)
        const result = await client.callTool({ name: 'run', arguments: { code: 'async () => 1' } })
        const expected = JSON.stringify('x'.repeat(30000), null, 2).slice(0, 20000)
        expect(textOf(result).startsWith(`${expected}… (truncated)`)).toBe(true)
    })

    it('results end with the status line', async () => {
        const filming = await connect(fakeSession({}, { browser: true, movie: 'm', step: '1a', cut: false }))
        expect(lastLine(textOf(await filming.callTool({ name: 'snapshot', arguments: {} })))).toBe('filming: 1a')

        const cut = await connect(fakeSession({}, { browser: true, movie: 'm', step: '1a', cut: true }))
        expect(lastLine(textOf(await cut.callTool({ name: 'cut', arguments: {} })))).toBe('cut')

        const idle = await connect(fakeSession())
        expect(lastLine(textOf(await idle.callTool({ name: 'resume', arguments: {} })))).toBe('idle')
    })

    it('errors also end with the status line', async () => {
        const session = fakeSession({ close: vi.fn(() => Promise.reject(new Error('boom'))) })
        const client = await connect(session)
        const result = await client.callTool({ name: 'close', arguments: {} })
        expect(result.isError).toBe(true)
        expect(textOf(result)).toContain('boom')
        expect(lastLine(textOf(result))).toBe('idle')
    })

    it('finish appends collected warnings before the status line', async () => {
        const warnings = ['raw/ was left behind']
        const client = await connect(fakeSession(), () => warnings.splice(0))
        const result = await client.callTool({ name: 'finish', arguments: {} })
        const lines = textOf(result).split('\n')
        expect(lines.at(-1)).toBe('idle')
        expect(lines.at(-2)).toContain('raw/ was left behind')
    })

    it('passes movie_start, step and retake arguments through', async () => {
        const session = fakeSession()
        const client = await connect(session)
        const meta = { dir: 'C:\\a b', id: 'm', title: 'T', scope: 's', parts: [{ code: '1', title: 'P' }] }
        await client.callTool({ name: 'movie_start', arguments: meta })
        expect(session.movieStart).toHaveBeenCalledWith(meta)
        const { id: _id, ...unnamed } = meta
        const started = await client.callTool({ name: 'movie_start', arguments: unnamed })
        expect(session.movieStart).toHaveBeenLastCalledWith(unnamed)
        expect(textOf(started)).toContain('Movie folder started in C:\\a b')
        await client.callTool({ name: 'step', arguments: { code: '1a', title: 'S', text: 'hi' } })
        expect(session.step).toHaveBeenCalledWith('1a', 'S', 'hi')
        await client.callTool({ name: 'retake', arguments: {} })
        expect(session.retake).toHaveBeenCalledWith(undefined)
    })

    it('runs one tool handler at a time', async () => {
        const order: Array<string> = []
        let release: () => void = () => undefined
        const gate = new Promise<void>((resolve) => {
            release = resolve
        })
        const session = fakeSession({
            run: vi.fn(async (code: string) => {
                order.push(`start ${code}`)
                if (code === 'first') await gate
                order.push(`end ${code}`)
                return null
            }),
        })
        const client = await connect(session)
        const a = client.callTool({ name: 'run', arguments: { code: 'first' } })
        const b = client.callTool({ name: 'run', arguments: { code: 'second' } })
        await new Promise((r) => setTimeout(r, 50))
        expect(order).toEqual(['start first'])
        release()
        await Promise.all([a, b])
        expect(order).toEqual(['start first', 'end first', 'start second', 'end second'])
    })
})
