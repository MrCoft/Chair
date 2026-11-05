import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    server: {
        port: 3200,
    },
    plugins: [
        viteTsConfigPaths({
            projects: ['./tsconfig.json'],
        }),
        tailwindcss(),
        tanstackStart({
            router: {
                entry: './router/router.tsx',
                generatedRouteTree: './router/routeTree.gen.ts',
                routeFileIgnorePattern: '[.](test|stories)[.][jt]sx?$',
            },
        }),
        nitro(),
        viteReact({
            babel: {
                plugins: [['babel-plugin-react-compiler']],
            },
        }),
    ],
})
