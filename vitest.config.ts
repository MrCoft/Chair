import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
    test: {
        projects: [
            {
                plugins: [viteTsConfigPaths({ projects: ['./tsconfig.json'] })],
                test: {
                    name: 'node',
                    environment: 'node',
                    include: ['src/**/*.test.ts'],
                    exclude: ['src/**/*.e2e.test.ts', '**/node_modules/**'],
                },
            },
            {
                plugins: [react(), viteTsConfigPaths({ projects: ['./tsconfig.json'] })],
                test: {
                    name: 'dom',
                    environment: 'jsdom',
                    include: ['src/**/*.test.tsx'],
                    setupFiles: ['./src/test/setup.ts'],
                    alias: [
                        {
                            find: /^@\/server\/movies$/,
                            replacement: resolve(import.meta.dirname, './src/test/serverMocks/movies.ts'),
                        },
                    ],
                },
            },
            {
                plugins: [viteTsConfigPaths({ projects: ['./tsconfig.json'] })],
                test: {
                    name: 'e2e',
                    environment: 'node',
                    include: ['src/**/*.e2e.test.ts'],
                    testTimeout: 120000,
                },
            },
        ],
    },
})
