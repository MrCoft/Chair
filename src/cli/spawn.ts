import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot, viewerEntry } from './view'

const DETACHED_IDLE_EXIT_MINUTES = 30

export function spawnDetachedView(dir: string, o: { at?: string; root?: string } = {}): string | null {
    const root = o.root ?? repoRoot()
    if (!existsSync(viewerEntry(root))) return `viewer not built — run pnpm build in ${root}, then chair view "${dir}"`
    const args = [
        join(root, 'bin', 'chair.mjs'),
        'view',
        dir,
        ...(o.at === undefined ? [] : ['--at', o.at]),
        '--idle-exit',
        String(DETACHED_IDLE_EXIT_MINUTES),
    ]
    const child = spawn(process.execPath, args, { detached: true, stdio: 'ignore', windowsHide: true })
    child.on('error', (error) => console.warn(`chair view could not start: ${error.message}`))
    child.unref()
    return null
}
