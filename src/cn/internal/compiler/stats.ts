/**
 * Compiler diagnostics used by tests and internal tooling.
 *
 * @internal
 */

import type { CnConfig } from "./config"
import { compileModel } from "./model"

export interface CompileStats {
  groups: number
  nodes: number
  edges: number
  liftedLiterals: number
  uniqueTails: number
  vlists: number
}

export const compileStats = (config: CnConfig): CompileStats => {
  const m = compileModel(config)
  return {
    groups: m.G,
    nodes: m.nodeCount,
    edges: m.totalEdges,
    liftedLiterals: m.litEntries.length,
    uniqueTails: m.uniqueTailCount,
    vlists: m.listPat.length,
  }
}
