/**
 * MIT License
 *
 * Copyright (c) 2023–Present PPResume (https://ppresume.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

import { IconCode, IconEye, IconLoader2 } from '@tabler/icons-react'
import type { Resume } from '@yamlresume/core'
import clsx from 'clsx'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ICON_SIZES, ICON_STROKES } from '@/constants'
import { useResumeRenderer } from '../../hooks'
import { CodeViewer } from './CodeViewer'
import { DocxViewer } from './DocxViewer'
import { HtmlViewer } from './HtmlViewer'
import { PdfViewer } from './PdfViewer'

/**
 * Props for the ResumeViewer component.
 */
export interface ResumeViewerProps {
  /** The pre-parsed resume object. */
  resume: Resume | null
  /** The index of the layout to use for rendering. */
  layoutIndex: number
  /**
   * Compiles LaTeX source to PDF bytes.
   *
   * Supply this to enable the rendered PDF preview for `latex` layouts. Hosts
   * without a LaTeX toolchain can omit it, and the TeX source view is shown
   * instead.
   */
  compileLatex?: (tex: string) => Promise<Uint8Array>
  /** Tooltip labels for the source/PDF toggle. */
  tooltips?: { source: string; pdf: string; compiling?: string }
}

/**
 * ResumeViewer component responsible for rendering the appropriate preview
 * (HTML, Markdown, LaTeX, or DOCX) based on the selected layout.
 *
 * For LaTeX layouts a host-provided `compileLatex` adds a toggle between the
 * TeX source and the compiled PDF, since compiling in the browser is not
 * something the renderer itself can do.
 *
 * @param props - The props for the ResumeViewer component.
 * @returns The rendered ResumeViewer component.
 */
export function ResumeViewer({
  compileLatex,
  layoutIndex,
  resume,
  tooltips,
}: ResumeViewerProps) {
  const { renderedContent, binaryContent, engine, error } = useResumeRenderer({
    resume,
    layoutIndex,
  })

  const [showPdf, setShowPdf] = useState(false)
  const [pdf, setPdf] = useState<Uint8Array | null>(null)
  const [compiling, setCompiling] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  const tex = engine === 'latex' ? renderedContent : ''
  const canCompile = Boolean(compileLatex) && tex !== ''
  const compile = compileLatex

  const lastLayoutIndex = useRef(layoutIndex)

  // Reset the toggle whenever the viewed layout changes, so a PDF from a
  // previous layout is never shown against new source.
  useEffect(() => {
    if (lastLayoutIndex.current !== layoutIndex) {
      lastLayoutIndex.current = layoutIndex
      setShowPdf(false)
      setPdf(null)
      setPdfError(null)
    }
  }, [layoutIndex])

  useEffect(() => {
    if (!showPdf || !compile || tex === '') {
      return () => {}
    }

    let cancelled = false

    setCompiling(true)
    setPdfError(null)

    compile(tex)
      .then((bytes) => {
        if (!cancelled) {
          setPdf(bytes)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setPdfError(
            e instanceof Error ? e.message : 'LaTeX compilation failed.'
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCompiling(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [compile, showPdf, tex])

  const toggle = useCallback(() => {
    setShowPdf((value) => !value)
  }, [])

  if (error) {
    return (
      <div
        role="alert"
        aria-live="polite"
        className={clsx(
          'h-full w-full p-4',
          'font-mono text-red-500 bg-red-50',
          'border border-red-200'
        )}
      >
        {error}
      </div>
    )
  }

  if (engine === 'docx') {
    return <DocxViewer content={binaryContent} />
  }

  if (engine === 'html') {
    return (
      <div className="h-full w-full flex flex-col bg-white">
        <HtmlViewer content={renderedContent} />
      </div>
    )
  }

  return (
    <div className="h-full w-full flex flex-col bg-white">
      {canCompile && (
        <div className="flex shrink-0 items-center gap-2 border-b border-neutral-400 bg-neutral-800 px-2 py-0.5">
          {showPdf && compiling && (
            <span
              role="status"
              aria-live="polite"
              data-testid="pdf-compiling-indicator"
              className="flex items-center gap-1.5 text-xs text-neutral-300"
            >
              <IconLoader2
                size={ICON_SIZES.xs}
                stroke={ICON_STROKES.sm}
                className="animate-spin"
              />
              {tooltips?.compiling}
            </span>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-pressed={showPdf}
            title={showPdf ? tooltips?.source : tooltips?.pdf}
            className={clsx(
              'ml-auto flex items-center gap-1.5 rounded px-2 py-1 text-xs',
              'transition-colors focus:outline-none focus:ring-1 focus:ring-neutral-400',
              showPdf
                ? 'bg-neutral-600 text-neutral-100'
                : 'text-neutral-300 hover:bg-neutral-700'
            )}
          >
            {showPdf ? (
              <IconCode size={ICON_SIZES.sm} stroke={ICON_STROKES.sm} />
            ) : (
              <IconEye size={ICON_SIZES.sm} stroke={ICON_STROKES.sm} />
            )}
            {showPdf ? tooltips?.source : tooltips?.pdf}
          </button>
        </div>
      )}
      {showPdf ? (
        <PdfViewer content={pdf} loading={compiling} error={pdfError} />
      ) : (
        <CodeViewer content={renderedContent} language={engine} />
      )}
    </div>
  )
}
