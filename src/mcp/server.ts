import { format } from 'node:util'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ChairSession } from './session'
import { registerTools } from './tools'

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
    const server = new McpServer({ name: 'chair', version: '0.1.0' })
    registerTools(server, session, () => warnings.splice(0))

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
