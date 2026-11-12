import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    reporters: ['verbose'],
    silent: false,
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    pool: 'threads',
  },
})
