import { defineConfig } from 'tsup'

const common = {
  format: ['cjs'],
  target: 'node24',
  shims: true,
  clean: true,
  sourcemap: false,
  noExternal: [/@actions\//],
} as const

export default defineConfig([
  {
    ...common,
    entry: ['.github/actions/release-notify/src/index.ts'],
    outDir: '.github/actions/release-notify/dist',
  },
  {
    ...common,
    entry: ['.github/actions/artifact-push/src/index.ts'],
    outDir: '.github/actions/artifact-push/dist',
  },
])
