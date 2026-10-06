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

import clsx from 'clsx'
import { useEffect, useState } from 'react'

/**
 * Props for the PdfViewer component.
 */
export interface PdfViewerProps {
  /** The rendered PDF bytes. */
  content: Uint8Array | null
  /** Whether a compilation is currently in flight. */
  loading?: boolean
  /** An error message to display instead of the PDF. */
  error?: string | null
}

/**
 * Builds a copy-safe ArrayBuffer for `Blob`, which rejects SharedArrayBuffer
 * backed views.
 *
 * @param content - The PDF bytes to copy.
 * @returns A standalone ArrayBuffer holding the same bytes.
 */
function toArrayBuffer(content: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(content.byteLength)

  new Uint8Array(buffer).set(content)

  return buffer
}

/**
 * Renders a PDF inside a sandboxed iframe.
 *
 * The component owns the object URL lifecycle so recompiled PDFs do not leak
 * and the previous document is revoked once a new one arrives.
 *
 * @param props - The component props.
 * @returns The rendered PdfViewer component.
 */
export function PdfViewer({ content, loading, error }: PdfViewerProps) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!content || content.byteLength === 0) {
      setUrl(null)
      return () => {}
    }

    const objectUrl = URL.createObjectURL(
      new Blob([toArrayBuffer(content)], { type: 'application/pdf' })
    )

    setUrl(objectUrl)

    return () => URL.revokeObjectURL(objectUrl)
  }, [content])

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

  if (!url) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-neutral-800 text-sm text-neutral-400">
        {loading ? 'Compiling PDF...' : 'No PDF available'}
      </div>
    )
  }

  return (
    <iframe
      title="PDF preview"
      src={url}
      className="h-full w-full border-0 bg-white"
    />
  )
}
