import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: false,  // Disabled due to build-time dependency resolution issues
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['@supabase/supabase-js', 'jsdom', '@mozilla/readability'],
});
