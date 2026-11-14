import { format } from 'node:util'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { readGuide } from '../guide'
import { ChairSession } from './session'
import { registerTools } from './tools'
import type { SessionLike } from './session'

export function createChairServer(session: SessionLike, takeWarnings: () => Array<string> = () => []) {
    const server = new McpServer(
        { name: 'chair', version: '0.1.0' },
        {
            instructions:
                'When asked to make Chair movies, film human-followable walkthroughs with these tools. Read chair://guide first (also available as `chair guide`). Use movie_start → step → run with h.click/h.type/h.hover for visible cursor, target outline, click ripple and slow actions; h.mark points at results. Write captions explaining what happens next, why, and what the observed result means. Keep default human pacing. Ordinary Playwright videos or hand-written movie.json exports do not provide these effects and must not be substituted for Chair-filmed walkthroughs. Existing user authorization still applies; do not add another approval loop for already requested movies.',
        },
    )
    registerTools(server, session, takeWarnings)
    server.registerResource(
        'recording-guide',
        'chair://guide',
        {
            mimeType: 'text/markdown',
            description:
                'Read before filming: Chair workflow, visual helpers, human pacing, before/result captions and quality checks.',
        },
        async (uri) => ({
            contents: [{ uri: uri.href, mimeType: 'text/markdown', text: await readGuide() }],
        }),
    )
    return server
}

function keepStdoutForProtocol(): void {
    const toStderr = (...args: Array<unknown>): void => {
        process.stderr.write(`${format(...args)}\n`)
    }
    console.log = toStderr
    console.info = toStderr
    console.debug = toStderr
}

export async function startMcpServer(): Promise<void> {
    const warnings: Array<string> = []
    const session = new ChairSession({ warn: (message) => warnings.push(message) })
    const server = createChairServer(session, () => warnings.splice(0))

    let closing = false
    const shutdown = async () => {
        if (closing) return
        closing = true
        await session.close({ discard: true }).catch(() => undefined)
        process.exit(0)
    }
    process.once('SIGINT', () => void shutdown())
    process.once('SIGTERM', () => void shutdown())
    process.stdin.once('close', () => void shutdown())

    keepStdoutForProtocol()
    await server.connect(new StdioServerTransport())
}
