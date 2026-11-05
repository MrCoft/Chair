import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

export const getContext = () => ({ queryClient: new QueryClient() })

export const Provider = ({ children, queryClient }: { children: ReactNode; queryClient: QueryClient }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)
