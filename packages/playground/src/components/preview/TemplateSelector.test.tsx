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

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TemplateSelector } from './TemplateSelector'

const YAML = 'layouts:\n  - engine: html\n    template: calm\n'

describe(TemplateSelector, () => {
  it('lists every template supported by the engine', () => {
    render(
      <TemplateSelector
        current="calm"
        layoutIndex={0}
        engine="html"
        onChange={vi.fn()}
        yaml={YAML}
      />
    )

    const select = screen.getByLabelText('Template') as HTMLSelectElement

    expect([...select.options].map((option) => option.value)).toStrictEqual([
      'calm',
      'vscode',
    ])
    expect(select.value).toBe('calm')
  })

  it('shows friendly names and descriptions', () => {
    render(
      <TemplateSelector
        current="moderncv-banking"
        layoutIndex={0}
        engine="latex"
        onChange={vi.fn()}
        yaml={YAML}
      />
    )

    expect(screen.getByText('ModernCV Banking')).toBeDefined()
    expect(screen.getByTitle('Template: ModernCV Banking')).toBeDefined()
  })

  it('reports the newly selected template', () => {
    const onChange = vi.fn()

    render(
      <TemplateSelector
        current="calm"
        layoutIndex={0}
        engine="html"
        onChange={onChange}
        yaml={YAML}
      />
    )

    fireEvent.change(screen.getByLabelText('Template'), {
      target: { value: 'vscode' },
    })

    expect(onChange).toHaveBeenCalledWith('vscode')
  })

  it('does not report a no-op selection', () => {
    const onChange = vi.fn()

    render(
      <TemplateSelector
        current="calm"
        layoutIndex={0}
        engine="html"
        onChange={onChange}
        yaml={YAML}
      />
    )

    fireEvent.change(screen.getByLabelText('Template'), {
      target: { value: 'calm' },
    })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('renders a placeholder when the layout sets no template', () => {
    render(
      <TemplateSelector
        layoutIndex={0}
        engine="html"
        onChange={vi.fn()}
        yaml="layouts:\n  - engine: html\n"
      />
    )

    const select = screen.getByLabelText('Template') as HTMLSelectElement

    expect(select.value).toBe('')
    expect([...select.options].map((option) => option.value)).toContain('')
  })

  it('renders nothing for engines without templates', () => {
    const { container } = render(
      <TemplateSelector
        layoutIndex={0}
        engine="markdown"
        onChange={vi.fn()}
        yaml={YAML}
      />
    )

    expect(container.innerHTML).toBe('')
  })

  it('accepts a custom label', () => {
    render(
      <TemplateSelector
        current="calm"
        layoutIndex={0}
        engine="html"
        onChange={vi.fn()}
        yaml={YAML}
        label="Vorlage"
      />
    )

    expect(screen.getByLabelText('Vorlage')).toBeDefined()
  })
})
