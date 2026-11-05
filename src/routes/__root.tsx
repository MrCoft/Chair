import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import appCss from '@/styles/globals.css?url'

interface RouterContext {
    queryClient: QueryClient
}

const RootDocument = ({ children }: { children: ReactNode }) => (
    <html lang="en" className="dark">
        <head>
            <HeadContent />
        </head>
        <body>
            {children}
            <Scripts />
        </body>
    </html>
)

export const Route = createRootRouteWithContext<RouterContext>()({
    head: () => ({
        meta: [
            { charSet: 'utf-8' },
            { name: 'viewport', content: 'width=device-width, initial-scale=1' },
            { title: 'Chair' },
        ],
        links: [{ rel: 'stylesheet', href: appCss }],
    }),
    component: () => <Outlet />,
    shellComponent: RootDocument,
})
