import type { CnConfig } from "./config"
import { compileModel } from "./model"

/**
 * Structural metrics collected from one compiled conflict model
 */
export interface CompileStats {
  /**
   * Number of conflict groups
   */
  groups: number

  /**
   * Number of radix-trie nodes
   */
  nodes: number

  /**
   * Number of radix-trie edges
   */
  edges: number

  /**
   * Number of literals lifted out of trie subtrees
   */
  liftedLiterals: number

  /**
   * Number of deduplicated literal-tail strings
   */
  uniqueTails: number

  /**
   * Number of compiled validator lists
   */
  vlists: number
}

/**
 * Compile a configuration and return structural model statistics
 *
 * **Parameters**
 * - `config` – Normalized conflict configuration to inspect
 *
 * **Returns**
 * - `CompileStats` – Structural metrics describing the compiled conflict model
 */
export const compileStats = (
    config: CnConfig,
): CompileStats => {
  // Compile the configuration into the normalized intermediate model
  const model = compileModel(config)

  // Return only structural metrics needed by diagnostics and regression tests
  return {
    groups: model.G,
    nodes: model.nodeCount,
    edges: model.totalEdges,
    liftedLiterals: model.litEntries.length,
    uniqueTails: model.uniqueTailCount,
    vlists: model.listPat.length,
  }
}