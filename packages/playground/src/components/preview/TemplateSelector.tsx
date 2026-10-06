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

import { IconPalette } from '@tabler/icons-react'
import type { LayoutEngine } from '@yamlresume/core'
import clsx from 'clsx'
import { type ChangeEvent, useCallback, useMemo } from 'react'

import { ICON_SIZES, ICON_STROKES } from '@/constants'
import { getTemplatesForEngine, setLayoutTemplate } from '@/utils'

/**
 * Props for the TemplateSelector component.
 */
export interface TemplateSelectorProps {
  /** The template currently configured on the active layout. */
  current?: string
  /** The index of the active layout within `layouts`. */
  layoutIndex: number
  /** The engine of the active layout, used to filter available templates. */
  engine?: LayoutEngine
  /** Callback invoked with the newly selected template identifier. */
  onChange: (template: string) => void
  /** The YAML source the change is applied to. */
  yaml: string
  /** Tooltip and accessible label text. */
  label?: string
}

/**
 * A toolbar control for switching the template of the active layout.
 *
 * Changing the selection rewrites `layouts[layoutIndex].template` in the YAML
 * source so the preview, the editor and any external `onChange` consumer all
 * stay in sync.
 *
 * Renders nothing for engines that have no templates, such as `markdown`.
 *
 * @param props - The component props.
 * @returns The rendered template selector, or `null` when unsupported.
 */
export function TemplateSelector({
  current,
  layoutIndex,
  engine,
  onChange,
  yaml,
  label = 'Template',
}: TemplateSelectorProps) {
  const templates = useMemo(() => getTemplatesForEngine(engine), [engine])

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const template = event.target.value

      // Guard against a no-op write so callers can skip needless updates.
      if (setLayoutTemplate(yaml, layoutIndex, template) !== yaml) {
        onChange(template)
      }
    },
    [layoutIndex, onChange, yaml]
  )

  if (templates.length === 0) {
    return null
  }

  const selected = templates.find((template) => template.id === current)

  return (
    <div className="flex h-full shrink-0 items-center gap-1.5 border-r border-neutral-400 px-2">
      <IconPalette size={ICON_SIZES.sm} stroke={ICON_STROKES.sm} />
      <select
        aria-label={label}
        title={selected ? `${label}: ${selected.name}` : label}
        value={current ?? ''}
        onChange={handleChange}
        className={clsx(
          'h-7 max-w-[160px] cursor-pointer truncate rounded border',
          'border-neutral-600 bg-neutral-800 px-1.5 text-xs text-neutral-200',
          'hover:bg-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-400'
        )}
      >
        {current === undefined && <option value="">{label}</option>}
        {templates.map((template) => (
          <option
            key={template.id}
            value={template.id}
            title={template.description}
          >
            {template.name}
          </option>
        ))}
      </select>
    </div>
  )
}
