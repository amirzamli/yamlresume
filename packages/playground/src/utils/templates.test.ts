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

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

import {
  getLayoutTemplate,
  getTemplatesForEngine,
  setLayoutTemplate,
} from './templates'

const SAMPLE = `# a leading comment
content:
  basics:
    name: Andy Dufresne

layouts:
  - engine: html
    # pick a template
    template: calm
    typography:
      fontSize: 16px
  - engine: latex
    template: moderncv-banking
    page:
      paperSize: a4
  - engine: markdown
`

describe(getTemplatesForEngine, () => {
  it('returns HTML templates with friendly names', () => {
    const templates = getTemplatesForEngine('html')

    expect(templates.map((t) => t.id)).toStrictEqual(['calm', 'vscode'])
    expect(templates[0]).toStrictEqual({
      id: 'calm',
      engine: 'html',
      name: 'Calm',
      description: expect.any(String),
    })
  })

  it('returns LaTeX templates', () => {
    expect(getTemplatesForEngine('latex').map((t) => t.id)).toStrictEqual([
      'jake',
      'moderncv-banking',
      'moderncv-casual',
      'moderncv-classic',
    ])
  })

  it('returns DOCX templates', () => {
    expect(getTemplatesForEngine('docx').map((t) => t.id)).toStrictEqual([
      'calm',
    ])
  })

  it('returns an empty array for engines without templates', () => {
    expect(getTemplatesForEngine('markdown')).toStrictEqual([])
  })

  it('returns an empty array for unknown or missing engines', () => {
    expect(getTemplatesForEngine(undefined)).toStrictEqual([])
    expect(getTemplatesForEngine('nope' as never)).toStrictEqual([])
  })
})

describe(getLayoutTemplate, () => {
  it('reads the template from a layout', () => {
    expect(getLayoutTemplate({ template: 'vscode' })).toBe('vscode')
  })

  it('returns undefined when the layout sets no template', () => {
    expect(getLayoutTemplate({ engine: 'markdown' })).toBeUndefined()
  })

  it('tolerates non-object and nullish values', () => {
    expect(getLayoutTemplate(undefined)).toBeUndefined()
    expect(getLayoutTemplate(null)).toBeUndefined()
    expect(getLayoutTemplate('nope')).toBeUndefined()
  })

  it('returns undefined for a non-string template', () => {
    expect(getLayoutTemplate({ template: 42 })).toBeUndefined()
  })
})

describe(setLayoutTemplate, () => {
  it('replaces the template of the targeted layout only', () => {
    const result = setLayoutTemplate(SAMPLE, 0, 'vscode')

    expect(result).toContain('template: vscode')
    expect(result).toContain('template: moderncv-banking')
    expect(parse(result)).toStrictEqual({
      ...(parse(SAMPLE) as object),
      layouts: [
        {
          engine: 'html',
          template: 'vscode',
          typography: { fontSize: '16px' },
        },
        {
          engine: 'latex',
          template: 'moderncv-banking',
          page: { paperSize: 'a4' },
        },
        { engine: 'markdown' },
      ],
    })
  })

  it('preserves comments and formatting elsewhere in the document', () => {
    const result = setLayoutTemplate(SAMPLE, 0, 'vscode')
    const before = SAMPLE.split('\n')
    const after = result.split('\n')

    expect(after).toHaveLength(before.length)
    expect(result).toContain('# a leading comment')
    expect(result).toContain('# pick a template')
    expect(result).toContain('      fontSize: 16px')

    // Only the one line differs.
    const changed = after.filter((line, i) => line !== before[i])
    expect(changed).toStrictEqual(['    template: vscode'])
  })

  it('can target a layout other than the first', () => {
    const result = setLayoutTemplate(SAMPLE, 1, 'jake')

    expect(result).toContain('template: calm')
    expect(parse(result).layouts[1].template).toBe('jake')
  })

  it('inserts a template key when the layout omits one', () => {
    const source =
      'layouts:\n  - engine: html\n    page:\n      paperSize: a4\n'
    const result = setLayoutTemplate(source, 0, 'calm')

    expect(result).toBe(
      'layouts:\n  - engine: html\n    template: calm\n    page:\n      paperSize: a4\n'
    )
    expect(parse(result).layouts[0].template).toBe('calm')
  })

  it('is a no-op when the value is unchanged', () => {
    expect(setLayoutTemplate(SAMPLE, 0, 'calm')).toBe(SAMPLE)
  })

  it('returns the source unchanged when there is nothing to edit', () => {
    expect(setLayoutTemplate('', 0, 'calm')).toBe('')
    expect(setLayoutTemplate('not: [a layout', 0, 'calm')).toBe(
      'not: [a layout'
    )
    expect(setLayoutTemplate('content: {}', 0, 'calm')).toBe('content: {}')
    expect(setLayoutTemplate(SAMPLE, 99, 'calm')).toBe(SAMPLE)
  })

  it('returns the source unchanged when the layout has no engine key', () => {
    const source = 'layouts:\n  - page:\n      paperSize: a4\n'

    expect(setLayoutTemplate(source, 0, 'calm')).toBe(source)
  })
})
