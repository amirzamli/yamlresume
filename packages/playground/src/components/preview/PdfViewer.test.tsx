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

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PdfViewer } from './PdfViewer'

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])

describe(PdfViewer, () => {
  // jsdom provides real object URL support backed by node, so both are stubbed
  // here to keep the assertions about URLs deterministic.
  let counter = 0

  beforeEach(() => {
    counter = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      counter += 1
      return `blob:pdf-${counter}`
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the PDF in an iframe', () => {
    render(<PdfViewer content={PDF} />)

    const frame = screen.getByTitle('PDF preview') as HTMLIFrameElement

    expect(frame.tagName).toBe('IFRAME')
    expect(frame.src).toContain('blob:pdf-1')
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
  })

  it('revokes the object URL on unmount', () => {
    const { unmount } = render(<PdfViewer content={PDF} />)
    unmount()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf-1')
  })

  it('revokes the previous URL when new bytes arrive', () => {
    const { rerender } = render(<PdfViewer content={PDF} />)
    rerender(<PdfViewer content={new Uint8Array([1, 2, 3])} />)

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf-1')
    expect(
      (screen.getByTitle('PDF preview') as HTMLIFrameElement).src
    ).toContain('blob:pdf-2')
  })

  it('shows an empty state without content', () => {
    render(<PdfViewer content={null} />)
    expect(screen.getByText('No PDF available')).toBeDefined()
  })

  it('shows an empty state for zero-length content', () => {
    render(<PdfViewer content={new Uint8Array([])} />)
    expect(screen.getByText('No PDF available')).toBeDefined()
  })

  it('shows a compiling state without content', () => {
    render(<PdfViewer content={null} loading />)
    expect(screen.getByText('Compiling PDF...')).toBeDefined()
  })

  it('keeps an existing PDF visible while a new one compiles', () => {
    render(<PdfViewer content={PDF} loading />)

    // The stale PDF stays mounted so the pane does not flash empty; the
    // compiling indicator lives in the toolbar row above it.
    expect(screen.getByTitle('PDF preview')).toBeDefined()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('prefers the error message over the PDF', () => {
    render(<PdfViewer content={PDF} error="LaTeX error: missing brace" />)

    expect(screen.getByRole('alert').textContent).toBe(
      'LaTeX error: missing brace'
    )
    expect(screen.queryByTitle('PDF preview')).toBeNull()
  })
})
