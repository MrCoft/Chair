//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'
import react from 'eslint-plugin-react'

export default [
    ...tanstackConfig,
    {
        ignores: [
            'eslint.config.js',
            'prettier.config.js',
            'src/router/routeTree.gen.ts',
            '.output/**',
            'dist/**',
            'test-output/**',
            'coverage/**',
        ],
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parserOptions: {
                project: ['./tsconfig.json'],
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        files: ['src/**/*.{ts,tsx}'],
        plugins: { react },
        rules: {
            'import/no-default-export': 'error',
        },
    },
]
