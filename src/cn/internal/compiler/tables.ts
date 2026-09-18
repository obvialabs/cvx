/**
 * Converts a normalized conflict model into the typed-array tables consumed
 * by the runtime engine.
 *
 * @internal
 */

import type { Tables, ValidatorImpls } from "../types"
import type { CnConfig } from "./config"
import { compileModel } from "./model"

const prefixSums = (counts: ArrayLike<number>): Int32Array => {
  const out = new Int32Array(counts.length + 1)
  for (let i = 0; i < counts.length; i++) out[i + 1] = out[i]! + counts[i]!
  return out
}

export interface CompiledTables {
  tables: Tables
  validatorImpls: ValidatorImpls
  prefix?: string
}

export const compileToTables = (config: CnConfig): CompiledTables => {
  const m = compileModel(config)
  // literal pool: same interning walk the packed module performs at load
  const litCount = m.litEntries.length
  const litAnchor = new Int32Array(litCount)
  const litGroup = new Int32Array(litCount)
  const litPool = new Int32Array(litCount)
  let poolText = ""
  const poolOffsets = new Int32Array(m.uniqueTailCount * 2)
  {
    const tailRef = new Map<string, number>()
    let nextRef = 0
    let e = 0
    for (const a of m.attachments) {
      for (const tail of m.sets[a.set]!) {
        let r = tailRef.get(tail)
        if (r === undefined) {
          r = nextRef++
          tailRef.set(tail, r)
          poolOffsets[r * 2] = poolText.length
          poolOffsets[r * 2 + 1] = tail.length
          poolText += tail
        }
        litAnchor[e] = a.anchor
        litGroup[e] = a.gid
        litPool[e] = r
        e++
      }
    }
  }
  const tables: Tables = {
    GROUP_COUNT: m.G,
    edgeStart: prefixSums(m.edgeCounts),
    labelStart: prefixSums(m.edgeLabelLen),
    labelText: m.labelText,
    edgeTarget: Int32Array.from(m.edgeTargetActual),
    nodeGroup: m.nodeGroup,
    nodeVlist: m.nodeVlist,
    vlistPat: prefixSums(m.patCounts),
    vlistOps: Int32Array.from(m.patOps),
    vlistRef: Int32Array.from(m.listPat),
    vlistGroup: m.vlistGroup,
    litAnchor,
    litGroup,
    litPool,
    poolOffsets,
    poolText,
    adjGid: Int32Array.from(m.adjGid),
    adjStart: prefixSums(m.adjCnt),
    adjTgt: Int32Array.from(m.adjTgt),
    patGid: Int32Array.from(m.patGid),
    patTgt: Int32Array.from(m.patTgt),
    postfixLookupGroups: Int32Array.from(m.postfixLookup),
    customValidatorNames: m.customNames,
    orderSensitiveModifiers: m.orderSensitiveModifiers,
  }
  return { tables, validatorImpls: m.impls, prefix: m.prefix }
}

