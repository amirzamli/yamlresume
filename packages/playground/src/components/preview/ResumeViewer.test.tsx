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

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { DEFAULT_RESUME, getResumeRenderer } from '@yamlresume/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CodeViewerProps } from './CodeViewer'
import type { DocxViewerProps } from './DocxViewer'
import type { HtmlViewerProps } from './HtmlViewer'
import { ResumeViewer } from './ResumeViewer'

// Mock sub-components
vi.mock('./HtmlViewer', () => ({
  HtmlViewer: ({ content }: HtmlViewerProps) => (
    <div data-testid="html-viewer-mock">
      <div data-testid="html-content">{content}</div>
    </div>
  ),
}))

vi.mock('./CodeViewer', () => ({
  CodeViewer: ({ content, language }: CodeViewerProps) => (
    <div data-testid="code-viewer-mock">
      <div data-testid="code-content">{content}</div>
      <div data-testid="code-language">{language}</div>
    </div>
  ),
}))

vi.mock('./DocxViewer', () => ({
  DocxViewer: ({ content }: DocxViewerProps) => (
    <div data-testid="docx-viewer-mock">
      <div data-testid="docx-content">
        {content ? `binary:${content.length}` : 'no-content'}
      </div>
    </div>
  ),
}))

// Mock @yamlresume/core
vi.mock('@yamlresume/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@yamlresume/core')>()
  return {
    ...actual,
    getResumeRenderer: vi.fn(() => ({
      render: () => 'rendered content',
    })),
  }
})

describe(ResumeViewer, () => {
  const validResume = DEFAULT_RESUME

  const emptyLayoutsResume = {
    ...DEFAULT_RESUME,
    layouts: [],
  }

  const docxResume = {
    ...DEFAULT_RESUME,
    layouts: [{ engine: 'docx' as const }],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Tests below override the renderer; clearAllMocks does not reset the
    // implementation, so restore the shared default here.
    vi.mocked(getResumeRenderer).mockImplementation(
      () =>
        ({ render: () => 'rendered content' }) as unknown as ReturnType<
          typeof getResumeRenderer
        >
    )
  })

  afterEach(() => {
    cleanup()
  })

  it('renders HTML preview correctly', () => {
    render(<ResumeViewer resume={validResume} layoutIndex={0} />)
    expect(screen.getByTestId('html-viewer-mock')).toBeDefined()
    expect(screen.getByTestId('html-content').textContent).toBe(
      'rendered content'
    )
  })

  it('renders LaTeX preview correctly', () => {
    render(<ResumeViewer resume={validResume} layoutIndex={1} />)
    expect(screen.getByTestId('code-viewer-mock')).toBeDefined()
    expect(screen.getByTestId('code-language').textContent).toBe('latex')
    expect(screen.getByTestId('code-content').textContent).toBe(
      'rendered content'
    )
  })

  describe('LaTeX PDF preview', () => {
    const tooltips = {
      source: 'Source',
      pdf: 'PDF',
      compiling: 'Compiling PDF...',
    }
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46])

    beforeEach(() => {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf')
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    })

    it('hides the toggle without a compiler', () => {
      render(<ResumeViewer resume={validResume} layoutIndex={1} />)
      expect(screen.queryByRole('button')).toBeNull()
    })

    it('compiles and renders the PDF when toggled', async () => {
      const compileLatex = vi.fn().mockResolvedValue(pdfBytes)

      render(
        <ResumeViewer
          resume={validResume}
          layoutIndex={1}
          compileLatex={compileLatex}
          tooltips={tooltips}
        />
      )

      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByTitle('PDF preview')).toBeDefined()
      })

      expect(compileLatex).toHaveBeenCalledWith('rendered content')
      expect(screen.queryByTestId('code-viewer-mock')).toBeNull()
    })

    it('toggles back to the TeX source', async () => {
      render(
        <ResumeViewer
          resume={validResume}
          layoutIndex={1}
          compileLatex={vi.fn().mockResolvedValue(pdfBytes)}
          tooltips={tooltips}
        />
      )

      fireEvent.click(screen.getByRole('button'))
      await waitFor(() => screen.getByTitle('PDF preview'))

      fireEvent.click(screen.getByRole('button'))

      expect(screen.queryByTitle('PDF preview')).toBeNull()
      expect(screen.getByTestId('code-viewer-mock')).toBeDefined()
    })

    it('shows a compiling overlay over a stale PDF when the source changes', async () => {
      let resolveFirst: (bytes: Uint8Array) => void = () => {}
      const compileLatex = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<Uint8Array>((resolve) => {
              resolveFirst = resolve
            })
        )
        .mockResolvedValue(pdfBytes)

      const { rerender } = render(
        <ResumeViewer
          resume={validResume}
          layoutIndex={1}
          compileLatex={compileLatex}
          tooltips={tooltips}
        />
      )

      fireEvent.click(screen.getByRole('button'))

      // Resolve the first compile, putting a PDF on screen.
      resolveFirst(pdfBytes)
      await waitFor(() => screen.getByTitle('PDF preview'))
      expect(screen.queryByTestId('pdf-compiling-indicator')).toBeNull()

      // Rendering now yields different TeX, which retriggers the compile while
      // the previous PDF is still on screen.
      vi.mocked(getResumeRenderer).mockImplementation(
        (resume: unknown) =>
          ({
            render: () =>
              (resume as { basics: { name: string } }).basics.name === 'Red'
                ? 'new rendered content'
                : 'rendered content',
          }) as unknown as ReturnType<typeof getResumeRenderer>
      )

      const changedResume = {
        ...validResume,
        basics: { name: 'Red' },
      } as unknown as typeof validResume

      rerender(
        <ResumeViewer
          resume={changedResume}
          layoutIndex={1}
          compileLatex={compileLatex}
          tooltips={tooltips}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('pdf-compiling-indicator')).toBeDefined()
      })

      expect(screen.getByTitle('PDF preview')).toBeDefined()
      expect(compileLatex).toHaveBeenLastCalledWith('new rendered content')
    })

    it('drops the previous PDF when the layout changes', async () => {
      const compileLatex = vi.fn().mockResolvedValue(pdfBytes)

      const { rerender } = render(
        <ResumeViewer
          resume={validResume}
          layoutIndex={1}
          compileLatex={compileLatex}
          tooltips={tooltips}
        />
      )

      fireEvent.click(screen.getByRole('button'))
      await waitFor(() => screen.getByTitle('PDF preview'))

      rerender(
        <ResumeViewer
          resume={validResume}
          layoutIndex={3}
          compileLatex={compileLatex}
          tooltips={tooltips}
        />
      )

      expect(screen.queryByTitle('PDF preview')).toBeNull()
      expect(screen.getByTestId('code-viewer-mock')).toBeDefined()
      expect(screen.queryByRole('button')).toBeNull()
    })

    it('reports compilation failures', async () => {
      render(
        <ResumeViewer
          resume={validResume}
          layoutIndex={1}
          compileLatex={vi.fn().mockRejectedValue(new Error('missing brace'))}
          tooltips={tooltips}
        />
      )

      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toBe('missing brace')
      })
    })

    it('does not offer the toggle for non-LaTeX layouts', () => {
      render(
        <ResumeViewer
          resume={validResume}
          layoutIndex={3}
          compileLatex={vi.fn()}
          tooltips={tooltips}
        />
      )
      expect(screen.queryByRole('button')).toBeNull()
    })
  })

  it('renders DOCX preview correctly', () => {
    const binaryData = new Uint8Array([1, 2, 3])
    vi.mocked(getResumeRenderer).mockImplementationOnce(
      () =>
        ({
          render: () => binaryData as unknown as string,
        }) as unknown as ReturnType<typeof getResumeRenderer>
    )
    render(<ResumeViewer resume={docxResume} layoutIndex={0} />)
    expect(screen.getByTestId('docx-viewer-mock')).toBeDefined()
    expect(screen.getByTestId('docx-content').textContent).toBe('binary:3')
  })

  it('renders Markdown preview correctly', () => {
    render(<ResumeViewer resume={validResume} layoutIndex={3} />)
    expect(screen.getByTestId('code-viewer-mock')).toBeDefined()
    expect(screen.getByTestId('code-language').textContent).toBe('markdown')
    expect(screen.getByTestId('code-content').textContent).toBe(
      'rendered content'
    )
  })

  it('renders DOCX preview correctly with default layouts', () => {
    const binaryData = new Uint8Array([1, 2, 3])
    vi.mocked(getResumeRenderer).mockImplementationOnce(
      () =>
        ({
          render: () => binaryData as unknown as string,
        }) as unknown as ReturnType<typeof getResumeRenderer>
    )
    render(<ResumeViewer resume={validResume} layoutIndex={2} />)
    expect(screen.getByTestId('docx-viewer-mock')).toBeDefined()
    expect(screen.getByTestId('docx-content').textContent).toBe('binary:3')
  })

  it('renders nothing when resume is null', () => {
    const { container } = render(<ResumeViewer resume={null} layoutIndex={2} />)
    // When resume is null, we get the default HTML viewer with empty content
    expect(
      container.querySelector('[data-testid="html-viewer-mock"]')
    ).toBeDefined()
  })

  it('displays error when layout index is invalid', () => {
    render(<ResumeViewer resume={emptyLayoutsResume} layoutIndex={0} />)
    expect(screen.getByText('Layout at index 0 not found.')).toBeDefined()
  })

  it('displays error when rendering fails', () => {
    vi.mocked(getResumeRenderer).mockImplementationOnce(() => {
      throw new Error('Render failure')
    })
    render(<ResumeViewer resume={validResume} layoutIndex={0} />)
    expect(screen.getByText(/Render Error: Render failure/)).toBeDefined()
  })

  it('displays error when rendering throws non-Error object', () => {
    vi.mocked(getResumeRenderer).mockImplementationOnce(() => {
      throw 'render string error'
    })
    render(<ResumeViewer resume={validResume} layoutIndex={0} />)
    expect(screen.getByText(/Render Error: render string error/)).toBeDefined()
  })
})
