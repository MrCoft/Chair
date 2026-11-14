import { execFile, spawn } from 'node:child_process'
import { once } from 'node:events'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { createServer } from 'node:net'
import { promisify } from 'node:util'
import { chromium } from 'playwright'
import { expect, it } from 'vitest'
import { defaultFfmpeg } from '../recorder/encode'
import { fixtureBookmarks, fixtureMovie } from '../test/fixtures'
import type { Browser } from 'playwright'
import type { ChildProcess } from 'node:child_process'

it.each(['flat', 'nested'])(
    'uses one production viewer to select, play, bookmark and discover movies (%s)',
    async (layout) => {
        const root = await mkdtemp(join(tmpdir(), 'chair-library-e2e-'))
        if (!resolve(root).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe test cleanup path')
        let child: ChildProcess | undefined
        let browser: Browser | undefined
        const library = layout === 'nested' ? join(root, '.chair') : root
        const first = layout === 'nested' ? 'scenarios/run one/first take' : 'first take',
            second = layout === 'nested' ? "scenarios/run two/it's 100% here" : "it's 100% here"
        const put = async (
            id: string,
            title: string,
            bookmarks = { version: 1 as const, items: [] as typeof fixtureBookmarks.items },
        ) => {
            const dir = join(library, id)
            await mkdir(dir, { recursive: true })
            await writeFile(join(dir, 'movie.json'), JSON.stringify({ ...fixtureMovie, title }))
            await writeFile(join(dir, 'bookmarks.json'), JSON.stringify(bookmarks))
            return dir
        }
        try {
            const firstDir = await put(first, 'Original movie', fixtureBookmarks)
            const secondDir = await put(second, 'Second movie')
            await promisify(execFile)(
                defaultFfmpeg(),
                [
                    '-y',
                    '-nostdin',
                    '-loglevel',
                    'error',
                    '-f',
                    'lavfi',
                    '-i',
                    'color=c=blue:s=320x180:r=10:d=20',
                    '-c:v',
                    'libx264',
                    '-pix_fmt',
                    'yuv420p',
                    '-preset',
                    'ultrafast',
                    join(firstDir, 'movie.mp4'),
                ],
                { windowsHide: true },
            )
            await copyFile(join(firstDir, 'movie.mp4'), join(secondDir, 'movie.mp4'))
            const socket = createServer()
            socket.listen(0, '127.0.0.1')
            await once(socket, 'listening')
            const address = socket.address()
            if (!address || typeof address === 'string') throw new Error('Cannot allocate test port')
            const port = address.port
            await new Promise<void>((done, reject) => socket.close((error) => (error ? reject(error) : done())))
            child = spawn(process.execPath, [resolve('.output/server/index.mjs')], {
                windowsHide: true,
                env: {
                    ...process.env,
                    CHAIR_DIR: library,
                    HOST: '127.0.0.1',
                    NITRO_HOST: '127.0.0.1',
                    PORT: String(port),
                    NITRO_PORT: String(port),
                },
                stdio: ['ignore', 'pipe', 'pipe'],
            })
            let logs = ''
            child.stdout?.on('data', (chunk) => {
                logs += String(chunk)
            })
            child.stderr?.on('data', (chunk) => {
                logs += String(chunk)
            })
            const viewer = child
            browser = await chromium.launch()
            const base = `http://127.0.0.1:${port}`
            await expect
                .poll(
                    async () => {
                        if (viewer.exitCode !== null) throw new Error(logs)
                        try {
                            return (await fetch(base)).status
                        } catch {
                            return 0
                        }
                    },
                    { timeout: 15000 },
                )
                .toBe(200)
            const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
            await page.goto(base)
            await page.getByRole('link', { name: 'Original movie', exact: true }).click()
            await page.getByRole('heading', { name: 'Original movie', exact: true }).waitFor()
            await page.goto(`${base}/m/${encodeURIComponent(first)}?at=2f&view=study`)
            await page.getByRole('heading', { name: 'Original movie', exact: true }).waitFor()
            await expect.poll(() => page.locator('video').evaluate((v) => (v as HTMLVideoElement).currentTime)).toBe(12)
            await page.getByRole('button', { name: 'Play', exact: true }).click()
            await expect.poll(() => page.locator('video').evaluate((v) => (v as HTMLVideoElement).paused)).toBe(false)
            const previousVideo = await page.locator('video').elementHandle()
            await page.getByRole('combobox', { name: 'Movie' }).selectOption(second)
            await page.getByRole('heading', { name: 'Second movie', exact: true }).waitFor()
            expect(new URL(page.url()).searchParams.get('view')).toBe('study')
            expect(new URL(page.url()).searchParams.has('at')).toBe(false)
            expect(await page.locator('video').getAttribute('src')).toBe(
                `/media/${encodeURIComponent(second)}/movie.mp4`,
            )
            expect(await page.locator('video').evaluate((v) => (v as HTMLVideoElement).paused)).toBe(true)
            expect(await page.locator('video').evaluate((v) => (v as HTMLVideoElement).currentTime)).toBe(0)
            expect(await previousVideo.evaluate((v) => (v as HTMLVideoElement).paused)).toBe(true)
            await page.getByRole('button', { name: /Bookmark 1 /i }).click()
            await expect
                .poll(async () =>
                    JSON.parse(await readFile(join(secondDir, 'bookmarks.json'), 'utf8')).items.map(
                        (b: { code: string }) => b.code,
                    ),
                )
                .toEqual(['1'])
            expect(JSON.parse(await readFile(join(firstDir, 'bookmarks.json'), 'utf8'))).toEqual(fixtureBookmarks)
            await page.reload()
            await page.getByText('1 bookmark', { exact: true }).waitFor()
            await page.goBack()
            await page.getByRole('heading', { name: 'Original movie', exact: true }).waitFor()
            await expect.poll(() => page.locator('video').evaluate((v) => (v as HTMLVideoElement).currentTime)).toBe(12)
            await page.setViewportSize({ width: 960, height: 760 })
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
            const third = await put(layout === 'nested' ? 'scenarios/new run/third' : 'third', 'Newly recorded movie')
            await copyFile(join(firstDir, 'movie.mp4'), join(third, 'movie.mp4'))
            await page.getByRole('link', { name: 'All movies', exact: true }).click()
            await page.getByRole('link', { name: 'Newly recorded movie', exact: true }).waitFor()
            await page.getByRole('link', { name: 'Second movie', exact: true }).click()
            await page.getByRole('heading', { name: 'Second movie', exact: true }).waitFor()
            expect(await page.getByRole('combobox', { name: 'Movie' }).inputValue()).toBe(second)
        } finally {
            await browser?.close()
            if (child?.exitCode === null) {
                const stopped = once(child, 'exit')
                child.kill()
                await stopped
            }
            await rm(root, { recursive: true, force: true })
        }
    },
)
