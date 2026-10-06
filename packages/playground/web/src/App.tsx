import { Playground } from '@yamlresume/playground'
import { getSampleResume } from '@yamlresume/samples'
import { useState } from 'react'

/**
 * Compiles TeX to PDF through the dev server.
 *
 * The playground runs in the browser, so LaTeX compilation is delegated to the
 * `/api/latex-pdf` endpoint added by the Vite config.
 *
 * @param tex - The TeX source to compile.
 * @returns The compiled PDF bytes.
 */
async function compileLatex(tex: string): Promise<Uint8Array> {
  const response = await fetch('/api/latex-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-tex' },
    body: tex,
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  return new Uint8Array(await response.arrayBuffer())
}

export default function App() {
  const [resume, setResume] = useState(
    getSampleResume('software-engineer', 'en', {
      withComments: true,
      withLayouts: true,
    })
  )

  return (
    <div className="h-screen w-screen">
      <Playground
        yaml={resume}
        onChange={setResume}
        compileLatex={compileLatex}
      />
    </div>
  )
}
