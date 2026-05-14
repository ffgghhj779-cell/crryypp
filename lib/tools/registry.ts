/**
 * Tool slug registry.
 *
 * Provides a deterministic, URL-safe slug for every ToolDef and
 * the reverse lookup needed by the dynamic route /tools/[slug].
 *
 * Examples:
 *   toolToSlug('SMC Order Blocks')   → 'smc-order-blocks'
 *   toolToSlug('Cup & Handle')       → 'cup-handle'
 *   slugToTool('cup-handle')         → { name: 'Cup & Handle', ... }
 */

import { ANALYSIS_TOOLS, type ToolDef } from '@/components/UnifiedScannerModal';

/** Convert a tool name to a URL-safe slug */
export function toolToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[&+]/g, '')          // strip & and +
    .replace(/[^a-z0-9]+/g, '-')  // non-alnum → dash
    .replace(/^-+|-+$/g, '');     // trim leading/trailing dashes
}

/** Reverse-lookup: slug → ToolDef (undefined if not found) */
export function slugToTool(slug: string): ToolDef | undefined {
  return ANALYSIS_TOOLS.find(t => toolToSlug(t.name) === slug);
}

/** All valid slugs — useful for generateStaticParams if needed */
export const ALL_TOOL_SLUGS = ANALYSIS_TOOLS.map(t => toolToSlug(t.name));
