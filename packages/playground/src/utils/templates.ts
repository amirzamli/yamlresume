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
  DOCX_TEMPLATE_OPTIONS,
  getDocxTemplateDetail,
  getHtmlTemplateDetail,
  getLatexTemplateDetail,
  HTML_TEMPLATE_OPTIONS,
  LATEX_TEMPLATE_OPTIONS,
  type LayoutEngine,
} from '@yamlresume/core'
import {
  type Document,
  isMap,
  isScalar,
  isSeq,
  type Node,
  parseDocument,
  type Scalar,
  type YAMLMap,
} from 'yaml'

/**
 * Metadata for a single selectable resume template.
 */
export interface TemplateOption {
  /** The template identifier written into `layouts[].template`. */
  id: string
  /** The rendering engine the template belongs to. */
  engine: LayoutEngine
  /** A human readable template name. */
  name: string
  /** A short description of the template. */
  description: string
}

/**
 * Maps a layout engine to the template identifiers it supports.
 *
 * Engines without templates, such as `markdown`, are intentionally absent.
 */
const ENGINE_TEMPLATES: Partial<Record<LayoutEngine, readonly string[]>> = {
  html: HTML_TEMPLATE_OPTIONS,
  latex: LATEX_TEMPLATE_OPTIONS,
  docx: DOCX_TEMPLATE_OPTIONS,
}

const TEMPLATE_DETAILS: Partial<
  Record<LayoutEngine, (id: string) => TemplateOption>
> = {
  html: (id) => getHtmlTemplateDetail(id as never),
  latex: (id) => getLatexTemplateDetail(id as never),
  docx: (id) => getDocxTemplateDetail(id as never),
}

/**
 * Lists the templates supported by a layout engine.
 *
 * @param engine - The layout engine to look up templates for.
 * @returns The available templates, or an empty array for engines that do not
 *   support templates.
 */
export function getTemplatesForEngine(engine?: LayoutEngine): TemplateOption[] {
  const ids = engine ? ENGINE_TEMPLATES[engine] : undefined
  const getDetail = engine ? TEMPLATE_DETAILS[engine] : undefined

  if (!ids || !getDetail) {
    return []
  }

  return ids.map((id) => getDetail(id))
}

/**
 * Reads the template identifier configured on a layout.
 *
 * @param layout - The layout object to read from.
 * @returns The configured template identifier, or `undefined` when the layout
 *   does not set one.
 */
export function getLayoutTemplate(layout: unknown): string | undefined {
  if (layout === null || typeof layout !== 'object') {
    return undefined
  }

  const template = (layout as { template?: unknown }).template

  return typeof template === 'string' ? template : undefined
}

/**
 * Returns the leading whitespace of the line a key node starts on.
 *
 * @param yaml - The YAML source containing the node.
 * @param node - The key node to locate.
 * @returns The line prefix, or `undefined` when the node has no range.
 */
function getLinePrefix(yaml: string, node: Node): string | undefined {
  if (!node.range) {
    return undefined
  }

  const lineStart = yaml.lastIndexOf('\n', node.range[0]) + 1

  return yaml.slice(lineStart, node.range[0])
}

/**
 * Computes the indentation a sibling key of `key` should use.
 *
 * The indentation of an existing sibling key is reused when one exists, so
 * unusual spacing is preserved. Otherwise it is derived from the sequence dash
 * that introduces the first key of the entry.
 *
 * @param yaml - The YAML source containing the map.
 * @param map - The map node whose keys are inspected.
 * @param key - The key node to derive indentation from.
 * @returns The indentation string, or `undefined` when it cannot be derived.
 */
function getKeyIndent(
  yaml: string,
  map: YAMLMap,
  key: string
): string | undefined {
  const keys = map.items.map((item) => item.key as Node | null | undefined)

  for (const keyNode of keys) {
    if (!isScalar(keyNode) || keyNode.value === key || !keyNode.range) {
      continue
    }

    const prefix = getLinePrefix(yaml, keyNode)

    // A prefix containing a dash means this key is itself the first entry of a
    // sequence item, so it cannot stand in for a sibling's indentation.
    if (prefix !== undefined && !prefix.includes('-')) {
      return prefix
    }
  }

  const targetKeyNode = keys.find(
    (keyNode) => isScalar(keyNode) && keyNode.value === key
  )

  if (!isScalar(targetKeyNode)) {
    return undefined
  }

  const prefix = getLinePrefix(yaml, targetKeyNode)
  const dashIndex = prefix?.indexOf('-')

  if (prefix === undefined || dashIndex === undefined || dashIndex === -1) {
    return prefix
  }

  // `- engine: html` renders its first key after the dash, so siblings sit two
  // spaces past the dash's own column.
  return `${prefix.slice(0, dashIndex)}  `
}

/**
 * Rewrites the `template` value of a single layout entry in a YAML document.
 *
 * The edit is applied as a targeted string replacement using the node ranges
 * reported by the YAML parser, so comments, key order and formatting elsewhere
 * in the document are left untouched. This matters here because the editor
 * shows commented sample resumes: re-serializing the whole document would strip
 * that guidance.
 *
 * @param yaml - The YAML source to edit.
 * @param layoutIndex - The index of the layout to update.
 * @param template - The template identifier to write.
 * @returns The updated YAML source, or the original source when the layout
 *   cannot be edited.
 */
export function setLayoutTemplate(
  yaml: string,
  layoutIndex: number,
  template: string
): string {
  let doc: Document
  try {
    doc = parseDocument(yaml)
  } catch (_e) {
    return yaml
  }

  const layouts = doc.get('layouts', true)
  if (!isSeq(layouts)) {
    return yaml
  }

  const layout = layouts.items[layoutIndex]
  if (!layout) {
    return yaml
  }

  const templateNode = isMap(layout)
    ? (layout.get('template', true) as Scalar | undefined)
    : undefined

  if (Array.isArray(templateNode?.range)) {
    const [start, valueEnd] = templateNode.range

    return yaml.slice(0, start) + template + yaml.slice(valueEnd)
  }

  // No `template` key yet: insert one right after `engine` so the generated
  // entry keeps the same key order as the curated samples.
  const engineNode = isMap(layout)
    ? (layout.get('engine', true) as Scalar | undefined)
    : undefined
  const engineRange = engineNode?.range

  if (!isMap(layout) || !Array.isArray(engineRange)) {
    return yaml
  }

  const indent = getKeyIndent(yaml, layout, 'engine')
  if (indent === undefined) {
    return yaml
  }

  const insertAt = engineRange[1]

  return (
    yaml.slice(0, insertAt) +
    `\n${indent}template: ${template}` +
    yaml.slice(insertAt)
  )
}
