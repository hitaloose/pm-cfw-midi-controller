/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** Emits sw.js with the list of every built file, so the app works offline. */
function serviceWorker(): Plugin {
  return {
    name: 'service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const publicDir = join(import.meta.dirname, 'public')
      const walk = (dir: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
          e.isDirectory() ? walk(join(dir, e.name)) : [relative(publicDir, join(dir, e.name))],
        )
      const files = [...Object.keys(bundle), ...walk(publicDir)].filter((f) => f !== 'index.html')
      const precache = ['./', ...files.map((f) => `./${f}`)].sort()
      const template = readFileSync(join(import.meta.dirname, 'sw/sw.js'), 'utf8')
      // Bundle files have content hashes in their names; public files and the
      // worker itself don't, so their contents go into the version too.
      const hash = createHash('sha256').update(precache.join('\n')).update(template)
      for (const f of walk(publicDir)) hash.update(readFileSync(join(publicDir, f)))
      const version = hash.digest('hex').slice(0, 12)
      const source = template
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(precache, null, 2))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig({
  // Relative asset paths: works at the GitHub Pages subpath (/pm-cfw-midi-controller/) and locally.
  base: './',
  plugins: [react(), serviceWorker()],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
