import path from 'path'

export default {
  test: {
    environment: 'node',
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', '.next/', 'supabase/', '**/*.config.*']
    }
  },
  ssr: {
    noExternal: ['next-auth'],
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './')
    }
  }
}
