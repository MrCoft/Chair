import { afterEach, expect, it, vi } from 'vitest'
import { startMcpServer } from './server'

const { atStart } = vi.hoisted(() => ({ atStart: { stdout: [] as Array<unknown>, stderr: [] as Array<unknown> } }))

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
    StdioServerTransport: class {
        start(): Promise<void> {
            const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
            const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
            console.log('from a snippet', { n: 1 })
            console.info('info')
            console.debug('debug')
            atStart.stdout.push(...stdout.mock.calls.map((call) => call[0]))
            atStart.stderr.push(...stderr.mock.calls.map((call) => call[0]))
            stdout.mockRestore()
            stderr.mockRestore()
            return Promise.resolve()
        }
        send(): Promise<void> {
            return Promise.resolve()
        }
        close(): Promise<void> {
            return Promise.resolve()
        }
    },
}))

const consoleBefore = { log: console.log, info: console.info, debug: console.debug }
const listenersBefore = {
    sigint: process.listeners('SIGINT'),
    sigterm: process.listeners('SIGTERM'),
    stdinClose: process.stdin.listeners('close'),
}

afterEach(() => {
    Object.assign(console, consoleBefore)
    for (const listener of process.listeners('SIGINT')) {
        if (!listenersBefore.sigint.includes(listener)) process.removeListener('SIGINT', listener)
    }
    for (const listener of process.listeners('SIGTERM')) {
        if (!listenersBefore.sigterm.includes(listener)) process.removeListener('SIGTERM', listener)
    }
    for (const listener of process.stdin.listeners('close')) {
        if (!listenersBefore.stdinClose.includes(listener)) {
            process.stdin.removeListener('close', listener as (...args: Array<unknown>) => void)
        }
    }
})

it('sends console output to stderr before the transport takes stdout for JSON-RPC', async () => {
    await startMcpServer()
    expect(atStart.stdout).toEqual([])
    expect(atStart.stderr).toEqual(['from a snippet { n: 1 }\n', 'info\n', 'debug\n'])
})
