import { spawn } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import open from 'open'
import type { Command } from './args'

export function repoRoot(): string {
    return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
}

export function viewerEntry(root: string): string {
    return join(root, '.output', 'server', 'index.mjs')
}

const IDLE_EXIT_PRELOAD = new URL('./idleExit.ts', import.meta.url).href

function freePort(): Promise<number> {
    return new Promise((resolvePort, reject) => {
        const server = createServer()
        server.once('error', reject)
        server.listen(0, '127.0.0.1', () => {
            const address = server.address()
            const port = typeof address === 'object' && address !== null ? address.port : 0
            server.close(() => resolvePort(port))
        })
    })
}

async function waitUntilServing(url: string, isAlive: () => boolean): Promise<void> {
    const deadline = Date.now() + 15_000
    while (Date.now() < deadline) {
        if (!isAlive()) throw new Error('viewer server exited before it was ready')
        try {
            await fetch(url)
            return
        } catch {
            await new Promise((r) => setTimeout(r, 200))
        }
    }
    throw new Error(`viewer did not answer at ${url} within 15 s`)
}

export async function runView(cmd: Extract<Command, { kind: 'view' }>, root: string): Promise<void> {
    const dir = resolve(cmd.dir)
    if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Error(`no such folder: ${cmd.dir}`)
    const entry = viewerEntry(root)
    if (!existsSync(entry)) throw new Error(`Viewer not built — run \`pnpm build\` in ${root}`)

    const port = cmd.port ?? (await freePort())
    const idleExitMs = cmd.idleExitMinutes === undefined ? undefined : Math.round(cmd.idleExitMinutes * 60_000)
    const preload = idleExitMs === undefined ? [] : ['--import', IDLE_EXIT_PRELOAD]
    const child = spawn(process.execPath, [...preload, entry], {
        stdio: 'inherit',
        windowsHide: true,
        env: {
            ...process.env,
            PORT: String(port),
            NITRO_PORT: String(port),
            HOST: '127.0.0.1',
            NITRO_HOST: '127.0.0.1',
            CHAIR_DIR: dir,
            ...(idleExitMs === undefined ? {} : { CHAIR_IDLE_EXIT_MS: String(idleExitMs) }),
        },
    })
    let exited = false
    const exit = new Promise<void>((done) =>
        child.once('exit', () => {
            exited = true
            done()
        }),
    )
    const stop = () => {
        if (!exited) child.kill()
    }
    process.once('SIGINT', () => {
        stop()
        process.exit(0)
    })
    process.once('exit', stop)

    const base = `http://127.0.0.1:${port}/`
    try {
        await waitUntilServing(base, () => !exited)
    } catch (error) {
        stop()
        throw error
    }
    const url = cmd.at === undefined ? base : `${base}?at=${encodeURIComponent(cmd.at)}`
    await open(url)
    console.log(url)
    await exit
}
