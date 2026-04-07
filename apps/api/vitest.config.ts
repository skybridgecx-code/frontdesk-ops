import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: [
      'src/routes/prospect-write.test.ts',
      'src/routes/prospect-attempts-write.test.ts',
      'src/routes/prospect-summary.test.ts',
      'src/routes/prospect-read.test.ts'
    ],
    restoreMocks: true
  }
});
