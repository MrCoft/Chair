import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import type { ReactNode } from 'react'
import * as TanstackQuery from '@/integrations/tanstack-query/root-provider'
import { stringifySearch } from '@/routes/-search'

export const getRouter = () => {
    const rqContext = TanstackQuery.getContext()

    return createRouter({
        routeTree,
        context: { ...rqContext },
        defaultPreload: 'intent',
        stringifySearch,
        Wrap: (props: { children: ReactNode }) => (
            <TanstackQuery.Provider {...rqContext}>{props.children}</TanstackQuery.Provider>
        ),
    })
}
