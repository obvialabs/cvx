import type { CnConfig } from "./config"
import { compileModel } from "./model"

/**
 * Character-code offset used to encode non-negative integer table values
 */
const PACK = 0x30

/**
 * Pack a numeric array into a JSON-safe UTF-16 string
 *
 * **Parameters**
 * - `values` – Numeric values to encode into the generated source module
 *
 * **Returns**
 * - `string` – JSON-escaped packed string containing the encoded numeric values
 */
const packStr = (
    values: ArrayLike<number>,
): string => {
  // Materialize the array-like input so values can be validated and chunked
  const entries = Array.from(values)

  // Ensure every shifted value remains inside the supported UTF-16 range
  for (const value of entries) {
    if (
        value + PACK >= 0xd800 ||
        value < 0
    ) {
      throw new Error(
          "cn compiler: unpackable value " +
          value,
      )
    }
  }

  let output = ""

  // Emit bounded chunks so large generated tables do not exceed argument limits
  for (
      let index = 0;
      index < entries.length;
      index += 4096
  ) {
    output += String.fromCharCode(
        ...entries
            .slice(
                index,
                index + 4096,
            )
            .map(
                (value) =>
                    value + PACK,
            ),
    )
  }

  // Serialize the packed string so quotes and control characters remain source-safe
  return JSON.stringify(output)
}

/**
 * Increment every numeric value by one
 *
 * **Parameters**
 * - `values` – Numeric values to offset
 *
 * **Returns**
 * - `number[]` – New array containing every input value incremented by one
 */
const plus1 = (
    values: ArrayLike<number>,
): number[] =>
    Array.from(
        values,
        (value) => value + 1,
    )

/**
 * Encode signed integers using zigzag encoding
 *
 * **Parameters**
 * - `values` – Signed numeric values to encode
 *
 * **Returns**
 * - `number[]` – Zigzag-encoded non-negative integers
 */
const zig = (
    values: ArrayLike<number>,
): number[] =>
    Array.from(
        values,
        (value) =>
            (value << 1) ^
            (value >> 31),
    )

/**
 * Convert absolute numeric values into deltas from the previous entry
 *
 * **Parameters**
 * - `values` – Absolute numeric values to convert
 *
 * **Returns**
 * - `number[]` – Difference between each value and its predecessor
 */
const deltas = (
    values: ArrayLike<number>,
): number[] => {
  let previous = 0

  return Array.from(
      values,
      (value) => {
        const delta =
            value - previous

        previous = value

        return delta
      },
  )
}

/**
 * Source-emission options used by internal table-generation tooling
 */
export interface EmitOptions {
  /**
   * Output language used for generated decoder helpers
   *
   * @default "js"
   */
  lang?: "ts" | "js"

  /**
   * Optional banner written at the beginning of the generated module
   */
  banner?: string
}

/**
 * Compile a normalized conflict configuration into a standalone source module
 *
 * **Parameters**
 * - `config` – Conflict configuration to compile
 * - `options` – Source-emission configuration
 *    - `lang` – Generated source language (`"js"` or `"ts"`, default: `"js"`)
 *    - `banner` – Optional generated-file banner written before emitted source
 *
 * **Returns**
 * - `string` – Standalone JavaScript or TypeScript module containing packed conflict lookup tables
 */
export const compileToSource = (
    config: CnConfig,
    options: EmitOptions = {},
): string => {
  // Compile the configuration through the shared deterministic intermediate model
  const model = compileModel(config)

  // Reject custom validator functions because generated modules cannot serialize executable identities
  if (model.customNames.length > 0) {
    throw new Error(
        "cn compiler: configs with custom validator functions cannot be emitted as a module " +
        `(functions are not serializable): ${model.customNames.join(", ")}. ` +
        "Use the internal configured composer factory at runtime instead.",
    )
  }

  // Enable TypeScript-specific annotations only when TypeScript output is requested
  const isTypeScript =
      options.lang === "ts"

  // Prepare language-specific decoder signatures embedded into generated source
  const signatures = {
    unpack: isTypeScript
        ? "(s: string, o = 0): Int32Array"
        : "(s, o = 0)",
    prefixSums: isTypeScript
        ? "(counts: Int32Array): Int32Array"
        : "(counts)",
    deltaZigzag: isTypeScript
        ? "(s: string): Int32Array"
        : "(s)",
  }

  // Store the common prefix of each sorted literal set only once
  const setsText = model.sets
      .map((tails) => {
        const first = tails[0]!
        const last =
            tails[tails.length - 1]!

        let prefixLength = 0

        // Determine the longest prefix shared by the first and last sorted tails
        while (
            prefixLength < first.length &&
            first[prefixLength] ===
            last[prefixLength]
            ) {
          prefixLength++
        }

        // Emit the shared prefix followed by every remaining suffix
        return [
          first.slice(
              0,
              prefixLength,
          ),
          ...tails.map(
              (tail) =>
                  tail.slice(prefixLength),
          ),
        ].join(" ")
      })
      .join("|")

  // Store attachment anchors as deltas because anchors are emitted in sorted order
  const attachmentAnchorDeltas: number[] = []

  // Preserve attachment conflict-group identifiers
  const attachmentGroups: number[] = []

  // Preserve deduplicated literal-set identifiers referenced by attachments
  const attachmentSets: number[] = []

  {
    let previousAnchor = 0

    // Flatten attachment metadata into independently packable numeric streams
    for (const attachment of model.attachments) {
      attachmentAnchorDeltas.push(
          attachment.anchor -
          previousAnchor,
      )

      previousAnchor =
          attachment.anchor

      attachmentGroups.push(
          attachment.gid,
      )

      attachmentSets.push(
          attachment.set,
      )
    }
  }

  // Store only nodes that actually reference a validator list
  const nodeValidatorAnchors: number[] = []
  const nodeValidatorValues: number[] = []

  for (
      let index = 0;
      index < model.nodeVlist.length;
      index++
  ) {
    if (model.nodeVlist[index]! >= 0) {
      nodeValidatorAnchors.push(index)

      nodeValidatorValues.push(
          model.nodeVlist[index]!,
      )
    }
  }

  // Use the caller-provided banner or the standard generated-file notice
  const banner =
      options.banner ??
      "// Generated CVX conflict tables. Do not edit by hand."

  // Emit the standalone decoder and packed runtime-table module
  return `${banner}
const P = ${PACK}

/**
 * Decode a packed integer string
 *
 * **Parameters**
 * - \`s\` – Packed UTF-16 string
 * - \`o\` – Additional numeric offset subtracted from every decoded value
 *
 * **Returns**
 * - \`Int32Array\` – Decoded numeric values
 */
const U = ${signatures.unpack} => {
    const out = new Int32Array(s.length)

    for (let i = 0; i < s.length; i++) {
        out[i] = s.charCodeAt(i) - P - o
    }

    return out
}

/**
 * Convert per-entry counts into prefix-sum offsets
 *
 * **Parameters**
 * - \`counts\` – Ordered entry counts
 *
 * **Returns**
 * - \`Int32Array\` – Prefix-sum offsets including the final exclusive boundary
 */
const PS = ${signatures.prefixSums} => {
    const out = new Int32Array(counts.length + 1)

    for (let i = 0; i < counts.length; i++) {
        out[i + 1] = out[i] + counts[i]
    }

    return out
}

/**
 * Decode a zigzag-encoded delta stream into running absolute values
 *
 * **Parameters**
 * - \`s\` – Packed zigzag-delta string
 *
 * **Returns**
 * - \`Int32Array\` – Reconstructed absolute numeric values
 */
const DZ = ${signatures.deltaZigzag} => {
    const out = new Int32Array(s.length)
    let accumulator = 0

    for (let i = 0; i < s.length; i++) {
        const encoded = s.charCodeAt(i) - P

        accumulator +=
            (encoded >>> 1) ^
            -(encoded & 1)

        out[i] = accumulator
    }

    return out
}

const GROUP_COUNT = ${model.G}
const customValidatorNames${isTypeScript ? ": string[]" : ""} = ${JSON.stringify(model.customNames)}

// Decode radix-edge ranges
const edgeStart = PS(
    U(${packStr(model.edgeCounts)})
)

// Decode radix-edge label ranges
const labelStart = PS(
    U(${packStr(model.edgeLabelLen)})
)

// Preserve concatenated radix-edge label text
const labelText = ${JSON.stringify(model.labelText)}

/**
 * Reconstruct radix-edge targets from pre-order subtree sizes
 *
 * **Returns**
 * - \`Int32Array\` – Target node for every emitted radix edge
 */
const edgeTarget = (() => {
    const nodeCount =
        edgeStart.length - 1

    const sizes =
        new Int32Array(nodeCount)

    // Calculate subtree sizes from the end of the pre-order node sequence
    for (
        let node = nodeCount - 1;
        node >= 0;
        node--
    ) {
        let size = 1
        let child = node + 1

        for (
            let edge = edgeStart[node];
            edge < edgeStart[node + 1];
            edge++
        ) {
            size += sizes[child]
            child += sizes[child]
        }

        sizes[node] = size
    }

    const output =
        new Int32Array(
            edgeStart[nodeCount]
        )

    let outputIndex = 0

    // Derive each direct child target from pre-order subtree boundaries
    for (
        let node = 0;
        node < nodeCount;
        node++
    ) {
        let child = node + 1

        for (
            let edge = edgeStart[node];
            edge < edgeStart[node + 1];
            edge++
        ) {
            output[outputIndex++] =
                child

            child += sizes[child]
        }
    }

    return output
})()

// Decode node groups after reversing the compiler-side +1 sentinel encoding
const nodeGroup = U(
    ${packStr(plus1(model.nodeGroup))},
    1
)

// Decode deduplicated validator-opcode patterns
const vlistPat = PS(
    U(${packStr(model.patCounts)})
)

const vlistOps = U(
    ${packStr(model.patOps)}
)

const vlistRef = U(
    ${packStr(model.listPat)}
)

const vlistGroup = DZ(
    ${packStr(
      zig(
          deltas(
              model.vlistGroup,
          ),
      ),
  )}
)

/**
 * Reconstruct sparse validator-list references for radix nodes
 *
 * **Returns**
 * - \`Int32Array\` – Validator-list identifier for each node, or \`-1\` when absent
 */
const nodeVlist = (() => {
    const output =
        new Int32Array(${model.nodeCount}).fill(-1)

    const anchors = DZ(
        ${packStr(
      zig(
          deltas(
              nodeValidatorAnchors,
          ),
      ),
  )}
    )

    const values = DZ(
        ${packStr(
      zig(
          deltas(
              nodeValidatorValues,
          ),
      ),
  )}
    )

    // Restore sparse validator references at their original node anchors
    for (
        let index = 0;
        index < anchors.length;
        index++
    ) {
        output[anchors[index]] =
            values[index]
    }

    return output
})()

// Restore deduplicated literal-tail sets from shared-prefix encoding
const SETS = ${JSON.stringify(setsText)}
    .split("|")
    .map((encoded) => {
        const tails =
            encoded.split(" ")

        const prefix =
            tails.shift()${isTypeScript ? "!" : ""}

        for (
            let index = 0;
            index < tails.length;
            index++
        ) {
            tails[index] =
                prefix + tails[index]
        }

        return tails
    })

// Decode literal attachment metadata
const AA = DZ(
    ${packStr(
      zig(
          attachmentAnchorDeltas,
      ),
  )}
)

const AG = DZ(
    ${packStr(
      zig(
          deltas(
              attachmentGroups,
          ),
      ),
  )}
)

const AS = DZ(
    ${packStr(
      zig(
          deltas(
              attachmentSets,
          ),
      ),
  )}
)

const litAnchor =
    new Int32Array(${model.litEntries.length})

const litGroup =
    new Int32Array(${model.litEntries.length})

const litPool =
    new Int32Array(${model.litEntries.length})

let poolText = ""

const poolOffsets =
    new Int32Array(${model.uniqueTailCount * 2})

{
    // Intern repeated literal tails while rebuilding attachment entries
    const tailReferences = new Map()

    let nextReference = 0
    let entryIndex = 0

    for (
        let attachmentIndex = 0;
        attachmentIndex < AA.length;
        attachmentIndex++
    ) {
        for (
            const tail of SETS[
                AS[attachmentIndex]
            ]
        ) {
            let reference =
                tailReferences.get(tail)

            if (reference === undefined) {
                reference =
                    nextReference++

                tailReferences.set(
                    tail,
                    reference
                )

                poolOffsets[
                    reference * 2
                ] = poolText.length

                poolOffsets[
                    reference * 2 + 1
                ] = tail.length

                poolText += tail
            }

            litAnchor[entryIndex] =
                AA[attachmentIndex]

            litGroup[entryIndex] =
                AG[attachmentIndex]

            litPool[entryIndex] =
                reference

            entryIndex++
        }
    }
}

// Decode ordinary conflict adjacency used by the runtime claim set
const adjGid = DZ(
    ${packStr(
      zig(
          deltas(
              model.adjGid,
          ),
      ),
  )}
)

const adjStart = PS(
    U(${packStr(model.adjCnt)})
)

const adjTgt = DZ(
    ${packStr(
      zig(
          deltas(
              model.adjTgt,
          ),
      ),
  )}
)

// Decode postfix-specific conflict relationships
const patGid = U(
    ${packStr(model.patGid)}
)

const patTgt = U(
    ${packStr(model.patTgt)}
)

// Decode groups requiring postfix-aware secondary lookup
const postfixLookupGroups = U(
    ${packStr(model.postfixLookup)}
)

// Preserve authored modifier ordering that cannot be normalized lexically
const orderSensitiveModifiers =
    ${JSON.stringify(model.orderSensitiveModifiers)}

export default {
    GROUP_COUNT,
    customValidatorNames,
    edgeStart,
    labelStart,
    labelText,
    edgeTarget,
    nodeGroup,
    nodeVlist,
    vlistPat,
    vlistOps,
    vlistRef,
    vlistGroup,
    litAnchor,
    litGroup,
    litPool,
    poolOffsets,
    poolText,
    adjGid,
    adjStart,
    adjTgt,
    patGid,
    patTgt,
    postfixLookupGroups,
    orderSensitiveModifiers,${model.prefix ? " prefix: " + JSON.stringify(model.prefix) + "," : ""}
}
`
}