import React from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider, createTheme } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@mantine/core/styles.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles.css'
import App from './App.jsx'

const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  headings: { fontFamily: 'Inter, system-ui, sans-serif', fontWeight: '680' },
  colors: { blue: ['#e9f1fe','#ccdefd','#9abefc','#6b9afa','#4680e5','#2463c5','#1c50a7','#1b448b','#1d3b73','#1c315c'] },
})
const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } })
createRoot(document.getElementById('root')).render(<React.StrictMode><MantineProvider theme={theme} defaultColorScheme="light"><QueryClientProvider client={queryClient}><App/></QueryClientProvider></MantineProvider></React.StrictMode>)
