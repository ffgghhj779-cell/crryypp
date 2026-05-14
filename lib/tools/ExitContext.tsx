'use client';

/**
 * ToolExitContext
 *
 * Shared context that lets ToolPageHeader (consumer) trigger the exit
 * animation that lives in ToolsLayout (provider).
 *
 * Pattern:
 *   ToolsLayout  → wraps the page in a motion.div, provides triggerExit()
 *   ToolPageHeader → calls triggerExit() on back press instead of router.back()
 *
 * This gives us a proper spring-physics exit animation before navigation.
 */

import { createContext, useContext } from 'react';

/** Async function: animates the page out, then calls router.back() */
export type ExitTrigger = () => Promise<void>;

export const ToolExitContext = createContext<ExitTrigger>(async () => {});

export const useToolExit = () => useContext(ToolExitContext);
