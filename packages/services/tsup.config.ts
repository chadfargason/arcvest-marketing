import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: false, // Disabled to avoid circular dependency issues with @arcvest/agents
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['@supabase/supabase-js', '@arcvest/agents', 'jsdom', '@mozilla/readability'],
});
