import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const LATEX_TIMEOUT_MS = 120_000

/**
 * Shells out to a LaTeX engine to compile TeX source into PDF bytes.
 *
 * The playground is browser-only, so compiling has to happen on the dev server.
 * `tectonic` is preferred because it needs no system TeX installation and
 * fetches its bundle on demand; `xelatex` is used as a fallback.
 *
 * @param tex - The TeX source to compile.
 * @returns The compiled PDF bytes.
 */
async function compileLatex(tex: string): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'yamlresume-latex-'))
  const texFile = join(dir, 'resume.tex')
  const pdfFile = join(dir, 'resume.pdf')

  try {
    await writeFile(texFile, tex, 'utf8')

    const engines = [
      { command: 'tectonic', args: ['-X', 'compile', 'resume.tex'] },
      { command: 'xelatex', args: ['-halt-on-error', 'resume.tex'] },
    ]

    // A missing binary is worth retrying with the next engine; a real TeX error
    // is not, and its stderr is far more useful to surface than the ENOENT of
    // whatever engine we fall back to.
    const failures: Error[] = []
    let compiled = false

    for (const engine of engines) {
      try {
        await new Promise<void>((resolve, reject) => {
          execFile(
            engine.command,
            engine.args,
            { cwd: dir, timeout: LATEX_TIMEOUT_MS },
            (error, _stdout, stderr) => {
              if (!error) {
                resolve()
                return
              }

              reject(
                error.code === 'ENOENT'
                  ? error
                  : new Error(String(stderr).trim() || error.message)
              )
            }
          )
        })

        compiled = true
        break
      } catch (e) {
        const failure = e instanceof Error ? e : new Error(String(e))

        if ((failure as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw failure
        }

        failures.push(failure)
      }
    }

    if (!compiled) {
      throw new Error(
        `No LaTeX engine found. Install tectonic or xelatex. (${failures
          .map((failure) => failure.message)
          .join(', ')})`
      )
    }

    // Read outside the loop so a missing PDF is not mistaken for a missing
    // engine and retried against the fallback.
    return await readFile(pdfFile)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/**
 * Adds a dev-server endpoint that compiles LaTeX to PDF.
 *
 * Only the dev harness needs this: it lets the playground preview real PDFs for
 * `latex` layouts without shipping a TeX engine to the browser. Requests must be
 * same-origin, since the endpoint executes a local binary.
 *
 * @returns The Vite plugin exposing the endpoint.
 */
function latexPreviewPlugin(): Plugin {
  return {
    name: 'yamlresume-latex-preview',
    configureServer(server) {
      server.middlewares.use('/api/latex-pdf', (req, res) => {
        const origin = req.headers.origin
        const host = req.headers.host

        // Require same-origin rather than matching a fixed address allowlist,
        // so the harness works over Tailscale, LAN and Docker interfaces. A
        // cross-site page cannot forge a matching Origin, which is what this
        // guards against: the endpoint shells out to a local binary.
        if (origin && host && origin !== `http://${host}`) {
          res.statusCode = 403
          res.end('Forbidden')
          return
        }

        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.setHeader('Allow', 'POST, OPTIONS')
          res.end()
          return
        }

        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        const chunks: Buffer[] = []

        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')

          if (body.length > 5_000_000) {
            res.statusCode = 413
            res.end('Payload Too Large')
            return
          }

          compileLatex(body)
            .then((pdf) => {
              res.setHeader('Content-Type', 'application/pdf')
              res.end(pdf)
            })
            .catch((e: unknown) => {
              res.statusCode = 500
              res.end(
                e instanceof Error ? e.message : 'LaTeX compilation failed'
              )
            })
        })
      })
    },
  }
}

// Serve and bundle the playground from its TypeScript sources so changes
// show up without a prior build step.
export default defineConfig({
  plugins: [react(), tailwindcss(), latexPreviewPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../src', import.meta.url)),
      '@yamlresume/playground': fileURLToPath(
        new URL('../src/index.ts', import.meta.url)
      ),
    },
  },
})
