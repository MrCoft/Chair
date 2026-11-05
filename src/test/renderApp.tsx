import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Outlet, RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { onTestFinished, vi } from 'vitest'
import { Route as IndexRoute } from '@/routes/index'
import { Route as MovieRoute } from '@/routes/m.$id'
import { stringifySearch } from '@/routes/-search'

const rootRoute = createRootRoute({ component: Outlet })

const routeTree = rootRoute.addChildren([
    IndexRoute.update({ id: '/', path: '/', getParentRoute: () => rootRoute } as never),
    MovieRoute.update({ id: '/m/$id', path: '/m/$id', getParentRoute: () => rootRoute } as never),
])

export const createAppRouter = (path: string) =>
    createRouter({
        routeTree,
        history: createMemoryHistory({ initialEntries: [path] }),
        stringifySearch,
    })

export const renderApp = (path: string) => {
    const router = createAppRouter(path)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router as never} />
        </QueryClientProvider>,
    )
    return router
}

export const findVideo = async (title: string): Promise<HTMLVideoElement> => {
    await screen.findByRole('heading', { name: title })
    const video = document.querySelector('video')
    if (!video) throw new Error('no <video> rendered')
    return video
}

export const expectLoaderError = () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    onTestFinished(() => {
        error.mockRestore()
        warn.mockRestore()
    })
}
