import { resolve } from 'node:path'
import { startMcpServer } from '../mcp/server'
import { exportCaptioned } from '../recorder/captions'
import { UsageError, parseArgs } from './args'
import { repoRoot, runView } from './view'

const USAGE = `chair — film a web app into a movie, then watch it

Usage:
  chair view <dir> [--at <code>] [--port <n>] [--idle-exit <minutes>]
                     open the viewer on a movies folder; --idle-exit stops it
                     after that many minutes without a request
  chair export <movie dir>
                     write movie-captioned.mp4, the download copy with the
                     caption box burned in (finish makes it for new movies)
  chair mcp          run the MCP server on stdio
  chair help         show this text
`

async function main(): Promise<void> {
    const cmd = parseArgs(process.argv.slice(2))
    if (cmd.kind === 'help') {
        process.stdout.write(USAGE)
    } else if (cmd.kind === 'mcp') {
        await startMcpServer()
    } else if (cmd.kind === 'export') {
        process.stdout.write(`${await exportCaptioned(resolve(cmd.dir))}\n`)
    } else {
        await runView(cmd, repoRoot())
    }
}

main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    if (error instanceof UsageError) {
        process.stderr.write(`${message}\n\n${USAGE}`)
        process.exit(2)
    }
    process.stderr.write(`${message}\n`)
    process.exit(1)
})
