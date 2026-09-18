import type { Tables, ValidatorImpls } from "../types"
import type { CnConfig } from "./config"
import { compileModel } from "./model"

/**
 * Convert per-entry counts into prefix-sum offsets
 *
 * **Parameters**
 * - `counts` – Ordered entry counts whose cumulative offsets should be calculated
 *
 * **Returns**
 * - `Int32Array` – Prefix-sum offsets with one additional trailing boundary
 */
const prefixSums = (
    counts: ArrayLike<number>,
): Int32Array => {
  // Allocate one additional slot for the final exclusive range boundary
  const output = new Int32Array(counts.length + 1)

  // Accumulate each count into the next prefix position
  for (let index = 0; index < counts.length; index++) {
    output[index + 1] =
        output[index]! +
        counts[index]!
  }

  return output
}

/**
 * Runtime artifacts produced from one normalized conflict configuration
 */
export interface CompiledTables {
  /**
   * Compact lookup tables consumed by the runtime conflict engine
   */
  tables: Tables

  /**
   * Runtime implementations for custom validators that could not become opcodes
   */
  validatorImpls: ValidatorImpls

  /**
   * Optional Tailwind v4 prefix encoded by the source configuration
   */
  prefix?: string
}

/**
 * Compile a normalized conflict configuration into runtime lookup tables
 *
 * **Parameters**
 * - `config` – Normalized conflict configuration to compile
 *
 * **Returns**
 * - `CompiledTables` – Typed-array lookup tables, custom validator implementations, and optional prefix metadata
 */
export const compileToTables = (
    config: CnConfig,
): CompiledTables => {
  // Compile the authored configuration into the normalized intermediate model
  const model = compileModel(config)

  // Determine the exact number of literal attachments that require table entries
  const literalCount = model.litEntries.length

  // Store the trie anchor associated with each literal entry
  const literalAnchors = new Int32Array(literalCount)

  // Store the conflict group associated with each literal entry
  const literalGroups = new Int32Array(literalCount)

  // Store references from literal entries into the shared literal text pool
  const literalPool = new Int32Array(literalCount)

  // Concatenate unique literal tails into one shared string allocation
  let poolText = ""

  // Store offset and length pairs for every unique literal tail
  const poolOffsets = new Int32Array(
      model.uniqueTailCount * 2,
  )

  {
    // Intern repeated literal tails so identical values share one pool entry
    const tailReferences = new Map<string, number>()

    let nextReference = 0
    let entryIndex = 0

    // Encode every literal attachment in deterministic model order
    for (const attachment of model.attachments) {
      // Expand the literal set referenced by the current attachment
      for (const tail of model.sets[attachment.set]!) {
        let reference = tailReferences.get(tail)

        // Add previously unseen literal text to the shared pool
        if (reference === undefined) {
          reference = nextReference++

          tailReferences.set(
              tail,
              reference,
          )

          // Store the starting offset of the literal inside the shared pool
          poolOffsets[reference * 2] =
              poolText.length

          // Store the literal length next to its starting offset
          poolOffsets[reference * 2 + 1] =
              tail.length

          // Append the literal text without introducing per-entry string objects
          poolText += tail
        }

        // Associate the literal with its trie anchor
        literalAnchors[entryIndex] =
            attachment.anchor

        // Associate the literal with its resolved conflict group
        literalGroups[entryIndex] =
            attachment.gid

        // Point the literal entry at its interned pool reference
        literalPool[entryIndex] =
            reference

        entryIndex++
      }
    }
  }

  // Assemble the compact runtime representation from the normalized model
  const tables: Tables = {
    GROUP_COUNT: model.G,

    // Convert per-node edge counts into contiguous edge ranges
    edgeStart: prefixSums(
        model.edgeCounts,
    ),

    // Convert edge-label lengths into offsets within the shared label string
    labelStart: prefixSums(
        model.edgeLabelLen,
    ),

    // Preserve the concatenated trie edge labels
    labelText: model.labelText,

    // Store trie edge destinations in a compact integer array
    edgeTarget: Int32Array.from(
        model.edgeTargetActual,
    ),

    // Preserve the conflict group assigned directly to each trie node
    nodeGroup: model.nodeGroup,

    // Preserve validator-list references assigned to trie nodes
    nodeVlist: model.nodeVlist,

    // Convert validator-pattern counts into contiguous pattern ranges
    vlistPat: prefixSums(
        model.patCounts,
    ),

    // Store compiled validator opcodes
    vlistOps: Int32Array.from(
        model.patOps,
    ),

    // Store validator references required by compiled pattern entries
    vlistRef: Int32Array.from(
        model.listPat,
    ),

    // Preserve the group emitted by each validator list
    vlistGroup: model.vlistGroup,

    // Store trie anchors for literal lookup entries
    litAnchor: literalAnchors,

    // Store conflict groups for literal lookup entries
    litGroup: literalGroups,

    // Store interned text-pool references for literal lookup entries
    litPool: literalPool,

    // Store offset and length pairs into the shared literal text pool
    poolOffsets,

    // Preserve all unique literal tails in one shared string
    poolText,

    // Store source conflict-group identifiers for adjacency ranges
    adjGid: Int32Array.from(
        model.adjGid,
    ),

    // Convert adjacency target counts into contiguous target ranges
    adjStart: prefixSums(
        model.adjCnt,
    ),

    // Store conflict-group targets for each adjacency entry
    adjTgt: Int32Array.from(
        model.adjTgt,
    ),

    // Store source groups participating in postfix conflicts
    patGid: Int32Array.from(
        model.patGid,
    ),

    // Store postfix conflict targets for each source group
    patTgt: Int32Array.from(
        model.patTgt,
    ),

    // Preserve groups requiring postfix-aware lookup behavior
    postfixLookupGroups: Int32Array.from(
        model.postfixLookup,
    ),

    // Preserve custom validator names referenced by runtime validator entries
    customValidatorNames:
    model.customNames,

    // Preserve modifier ordering rules that cannot be normalized lexically
    orderSensitiveModifiers:
    model.orderSensitiveModifiers,
  }

  // Return the compiled runtime tables together with non-opcode validator implementations
  return {
    tables,
    validatorImpls: model.impls,
    prefix: model.prefix,
  }
}