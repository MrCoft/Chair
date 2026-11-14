import { readFile } from 'node:fs/promises'

export const readGuide = (): Promise<string> => readFile(new URL('../docs/agent-guide.md', import.meta.url), 'utf8')
