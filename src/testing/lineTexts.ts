import type { ReactTestInstance } from 'react-test-renderer';

import { INLINE_DIVIDER } from '@/ui/MetaLine';

const flat = (c: unknown): string =>
  typeof c === 'string' || typeof c === 'number'
    ? String(c)
    : Array.isArray(c)
      ? c.map(flat).join('')
      : c && typeof c === 'object' && 'children' in c
        ? flat((c as ReactTestInstance).children)
        : '';

/**
 * Each outermost text on screen as one string, nested runs joined, with an inline divider read as
 * " | " (round 124): "Departed | Los Angeles".
 */
const isText = (n: ReactTestInstance | null | undefined) => !!n && (n.type as unknown) === 'Text';

export function lineTexts(root: ReactTestInstance): string[] {
  const outer = root.findAll((n) => isText(n) && !isText(n.parent) && !isText(n.parent?.parent));
  return outer.map((n) => flat(n.children).split(INLINE_DIVIDER).join(' | '));
}
