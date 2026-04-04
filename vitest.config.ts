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
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './')
    }
  }
}
