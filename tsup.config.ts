import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['.github/actions/release-notify/src/index.ts'],
  outDir: '.github/actions/release-notify/dist',
  format: ['cjs'],
  target: 'node24',
  shims: true,
  clean: true,
  sourcemap: false,
  // everything must land in the bundle: the runner executes dist/ without node_modules
  noExternal: [/@actions\//],
})
