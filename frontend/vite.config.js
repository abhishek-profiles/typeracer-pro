import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react({
    // Enable Fast Refresh for React components
    jsxRuntime: 'automatic',
    // Include all JSX files
    include: /\.(jsx|tsx|js|ts|mdx)$/,
    babel: {
      // Enable parsing of class properties and decorators
      parserOpts: {
        plugins: ['decorators-legacy', 'classProperties']
      },
      // Use project's Babel configuration if exists
      babelrc: true,
      configFile: true
    }
  })],
})
