import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/runner.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['@supabase/supabase-js', '@anthropic-ai/sdk', '@arcvest/services'],
});
