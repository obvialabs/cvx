/**
 * Builds the normalized conflict model used by the `cn` compiler.
 *
 * The model stage owns configuration classification, trie preparation,
 * literal lifting, conflict adjacency, and validator registration. It does not
 * emit runtime tables or source text.
 *
 * @internal
 */

import type { Tables, ValidatorImpls } from "../types.js"
import * as refValidators from "../validators.js"

import {
  cloneConfig,
  type ClassGroupDefinition,
  type CnConfig,
} from "./config.js"

const isMarker = (def: object, key: string): boolean => {
  const keys = Object.keys(def)
  return (
    keys.length === 1 &&
    keys[0] === key &&
    typeof (def as never)[key] === "string"
  )
}
const isThemeGetterFn = (
  fn: unknown
): fn is ((theme: object) => ClassGroupDefinition[]) & { isThemeGetter: true } =>
  typeof fn === "function" &&
  (fn as { isThemeGetter?: boolean }).isThemeGetter === true

// ---------------------------------------------------------------------------
// validator resolution
// ---------------------------------------------------------------------------

// span-opcode ids — must mirror the engine's runValidator switch
const OPS: Record<string, number> = {
  isAny: 0,
  isAnyNonArbitrary: 1,
  isArbitraryValue: 2,
  isArbitraryVariable: 3,
  isFraction: 4,
  isNumber: 5,
  isInteger: 6,
  isPercent: 7,
  isTshirtSize: 8,
  isNamedContainerQuery: 9,
  isArbitraryLength: 10,
  isArbitraryNumber: 11,
  isArbitraryWeight: 12,
  isArbitraryFamilyName: 13,
  isArbitraryPosition: 14,
  isArbitrarySize: 15,
  isArbitraryImage: 16,
  isArbitraryShadow: 17,
  isArbitraryVariableLength: 18,
  isArbitraryVariableFamilyName: 19,
  isArbitraryVariablePosition: 20,
  isArbitraryVariableSize: 21,
  isArbitraryVariableImage: 22,
  isArbitraryVariableShadow: 23,
  isArbitraryVariableWeight: 24,
}
const CUSTOM_OP_BASE = 25

interface ValidatorRegistry {
  /** ordered unique validator names (opcode names or generated custom names) */
  names: string[]
  idByName: Map<string, number>
  /** custom validator implementations, keyed by generated name */
  impls: ValidatorImpls
  fnName: Map<(value: string) => boolean, string>
  /** name → plain-string predicate, for the compiler's own classifier */
  classifierFns: Map<string, (value: string) => boolean>
}

const newRegistry = (): ValidatorRegistry => ({
  names: [],
  idByName: new Map(),
  impls: {},
  fnName: new Map(),
  classifierFns: new Map(),
})

const validatorIdFor = (
  reg: ValidatorRegistry,
  name: string,
  impl: (value: string) => boolean
): number => {
  let id = reg.idByName.get(name)
  if (id === undefined) {
    id = reg.names.length
    reg.names.push(name)
    reg.idByName.set(name, id)
    reg.classifierFns.set(name, impl)
  }
  return id
}

const resolveValidator = (
  reg: ValidatorRegistry,
  def: { $v: string } | ((value: string) => boolean)
): number => {
  if (typeof def === "function") {
    let name = reg.fnName.get(def)
    if (name === undefined) {
      name = "$c" + reg.fnName.size
      reg.fnName.set(def, name)
      reg.impls[name] = def
    }
    return validatorIdFor(reg, name, def)
  }
  const name = def.$v
  const ref = (
    refValidators as unknown as Record<string, (value: string) => boolean>
  )[name]
  if (OPS[name] === undefined || !ref)
    throw new Error(`cn: unknown validator "${name}"`)
  return validatorIdFor(reg, name, ref)
}

// ---------------------------------------------------------------------------
// part-trie construction
// ---------------------------------------------------------------------------

interface PartNode {
  nextPart: Map<string, PartNode>
  validators: { validatorId: number; groupId: number }[] | null
  classGroupId: number
  lit: { tail: string; gid: number }[]
}
const newPartNode = (): PartNode => ({
  nextPart: new Map(),
  validators: null,
  classGroupId: -1,
  lit: [],
})

const expandTheme = (config: CnConfig, key: string): readonly ClassGroupDefinition[] =>
  config.theme[key] ?? []

const buildPartTrie = (
  config: CnConfig,
  reg: ValidatorRegistry,
  groupId: (name: string) => number
): PartNode => {
  const root = newPartNode()
  const getPart = (node: PartNode, path: string): PartNode => {
    for (const part of path.split("-")) {
      let next = node.nextPart.get(part)
      if (!next) {
        next = newPartNode()
        node.nextPart.set(part, next)
      }
      node = next
    }
    return node
  }
  const process = (def: ClassGroupDefinition, node: PartNode, gid: number): void => {
    if (typeof def === "string") {
      const target = def === "" ? node : getPart(node, def)
      target.classGroupId = gid
      return
    }
    if (typeof def === "function") {
      if (isThemeGetterFn(def)) {
        for (const inner of def(config.theme)) process(inner, node, gid)
        return
      }
      ;(node.validators ??= []).push({
        validatorId: resolveValidator(reg, def),
        groupId: gid,
      })
      return
    }
    if (isMarker(def, "$t")) {
      for (const inner of expandTheme(config, (def as { $t: string }).$t))
        process(inner, node, gid)
      return
    }
    if (isMarker(def, "$v")) {
      ;(node.validators ??= []).push({
        validatorId: resolveValidator(reg, def as { $v: string }),
        groupId: gid,
      })
      return
    }
    for (const [key, value] of Object.entries(
      def as { [key: string]: readonly ClassGroupDefinition[] }
    )) {
      const child = getPart(node, key)
      for (const inner of value) process(inner, child, gid)
    }
  }
  for (const [name, group] of Object.entries(config.classGroups)) {
    const gid = groupId(name)
    for (const def of group) process(def, root, gid)
  }
  return root
}

// ---------------------------------------------------------------------------
// subsetting — classify a corpus against the full config, drop unused groups
// ---------------------------------------------------------------------------

export interface SubsetResult {
  config: CnConfig
  usedGroups: number
  totalGroups: number
}

export const subsetConfig = (
  base: CnConfig,
  tokens: Iterable<string>
): SubsetResult => {
  const config = cloneConfig(base)
  const reg = newRegistry()
  const groupNames: string[] = []
  const idByName = new Map<string, number>()
  const gidOf = (name: string) => {
    let id = idByName.get(name)
    if (id === undefined) {
      id = groupNames.length
      groupNames.push(name)
      idByName.set(name, id)
    }
    return id
  }
  const root = buildPartTrie(config, reg, gidOf)

  const walk = (parts: string[], idx: number, node: PartNode): number => {
    if (idx === parts.length) return node.classGroupId
    const next = node.nextPart.get(parts[idx]!)
    if (next) {
      const r = walk(parts, idx + 1, next)
      if (r >= 0) return r
    }
    // lifted-literal check is unnecessary here: subsetting runs before lifting
    if (!node.validators) return -1
    const rest = parts.slice(idx).join("-")
    for (const { validatorId, groupId } of node.validators) {
      const fn = reg.classifierFns.get(reg.names[validatorId]!)!
      if (fn(rest)) return groupId
    }
    return -1
  }
  const classify = (bareBase: string): number => {
    if (bareBase.startsWith("[") && bareBase.endsWith("]")) return -1 // arbitrary property: dynamic group
    const parts = bareBase.split("-")
    return walk(parts, parts[0] === "" && parts.length > 1 ? 1 : 0, root)
  }

  const prefix = config.prefix ? config.prefix + ":" : null
  const used = new Set<string>()
  for (let token of tokens) {
    if (!token) continue
    if (prefix) {
      if (!token.startsWith(prefix)) continue
      token = token.slice(prefix.length)
    }
    let dB = 0
    let dP = 0
    let lastColon = -1
    let lastSlash = -1
    for (let i = 0; i < token.length; i++) {
      const c = token[i]
      if (dB === 0 && dP === 0) {
        if (c === ":") lastColon = i
        else if (c === "/") lastSlash = i
      }
      if (c === "[") dB++
      else if (c === "]") dB--
      else if (c === "(") dP++
      else if (c === ")") dP--
    }
    let bare = token.slice(lastColon + 1)
    if (bare.endsWith("!")) bare = bare.slice(0, -1)
    else if (bare.startsWith("!")) bare = bare.slice(1)
    const candidates =
      lastSlash > lastColon
        ? [bare, token.slice(lastColon + 1, lastSlash).replace(/^!/, "")]
        : [bare]
    for (const cand of candidates) {
      const g = classify(cand)
      if (g >= 0) used.add(groupNames[g]!)
    }
  }

  const totalGroups = Object.keys(config.classGroups).length
  for (const key of Object.keys(config.classGroups)) {
    if (!used.has(key)) delete config.classGroups[key]
  }
  for (const key of Object.keys(config.conflictingClassGroups)) {
    if (!used.has(key)) delete config.conflictingClassGroups[key]
  }
  for (const key of Object.keys(config.conflictingClassGroupModifiers)) {
    if (!used.has(key)) delete config.conflictingClassGroupModifiers[key]
  }
  return { config, usedGroups: used.size, totalGroups }
}

// ---------------------------------------------------------------------------
// the compile pipeline: part-trie → lift → char-trie → radix → flat model
// ---------------------------------------------------------------------------

export interface CompiledModel {
  G: number
  customNames: string[]
  impls: ValidatorImpls
  edgeCounts: Int32Array
  edgeLabelLen: Int32Array
  labelText: string
  edgeTargetActual: number[]
  nodeGroup: Int32Array
  nodeVlist: Int32Array
  nodeCount: number
  totalEdges: number
  patCounts: number[]
  patOps: number[]
  listPat: number[]
  vlistGroup: Int32Array
  litEntries: { anchor: number; tail: string; gid: number }[]
  sets: string[][]
  attachments: { anchor: number; gid: number; set: number }[]
  uniqueTailCount: number
  adjGid: number[]
  adjCnt: number[]
  adjTgt: number[]
  patGid: number[]
  patTgt: number[]
  postfixLookup: number[]
  orderSensitiveModifiers: string
  prefix?: string
}

export const compileModel = (config: CnConfig): CompiledModel => {
  const reg = newRegistry()
  const groupNames: string[] = []
  const groupIdByName = new Map<string, number>()
  const groupId = (name: string): number => {
    let id = groupIdByName.get(name)
    if (id === undefined) {
      id = groupNames.length
      groupNames.push(name)
      groupIdByName.set(name, id)
    }
    return id
  }

  const partRoot = buildPartTrie(config, reg, groupId)

  // ---- subtree literal lifting ----
  const isLiftable = (node: PartNode): boolean => {
    if (node.validators) return false
    for (const child of node.nextPart.values())
      if (!isLiftable(child)) return false
    return true
  }
  const collectLifted = (
    node: PartNode,
    prefix: string,
    out: { tail: string; gid: number }[]
  ) => {
    if (node.classGroupId >= 0)
      out.push({ tail: prefix, gid: node.classGroupId })
    for (const [part, child] of node.nextPart)
      collectLifted(child, prefix + "-" + part, out)
  }
  const pruneNode = (node: PartNode) => {
    for (const [part, child] of [...node.nextPart]) {
      if (isLiftable(child)) {
        collectLifted(child, part, node.lit)
        node.nextPart.delete(part)
      } else {
        pruneNode(child)
      }
    }
  }
  pruneNode(partRoot)

  // ---- flatten pruned part-trie → char-level trie ----
  interface CharNode {
    edges: Map<number, number>
    groupId: number
    vlist: number
  }
  const charNodes: CharNode[] = [{ edges: new Map(), groupId: -1, vlist: -1 }]
  const newCharNode = (): number => {
    charNodes.push({ edges: new Map(), groupId: -1, vlist: -1 })
    return charNodes.length - 1
  }
  const vlists: [number, number][][] = []
  const vlistIndex = new Map<string, number>()
  const internVlist = (
    list: { validatorId: number; groupId: number }[]
  ): number => {
    const key = list.map((e) => e.validatorId + ":" + e.groupId).join(",")
    let idx = vlistIndex.get(key)
    if (idx === undefined) {
      idx = vlists.length
      vlists.push(list.map((e) => [e.validatorId, e.groupId]))
      vlistIndex.set(key, idx)
    }
    return idx
  }
  const insertChars = (fromIdx: number, str: string): number => {
    let cur = fromIdx
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i)
      let next = charNodes[cur]!.edges.get(c)
      if (next === undefined) {
        next = newCharNode()
        charNodes[cur]!.edges.set(c, next)
      }
      cur = next
    }
    return cur
  }
  const DASH = 45
  const litEntries: { anchor: number; tail: string; gid: number }[] = []
  const flatten = (partNode: PartNode, charIdx: number, isRoot: boolean) => {
    if (partNode.classGroupId >= 0)
      charNodes[charIdx]!.groupId = partNode.classGroupId
    if (partNode.validators)
      charNodes[charIdx]!.vlist = internVlist(partNode.validators)
    for (const { tail, gid } of partNode.lit)
      litEntries.push({ anchor: charIdx, tail, gid })
    for (const [part, child] of partNode.nextPart) {
      let entry = charIdx
      if (!isRoot) {
        let dashNode = charNodes[charIdx]!.edges.get(DASH)
        if (dashNode === undefined) {
          dashNode = newCharNode()
          charNodes[charIdx]!.edges.set(DASH, dashNode)
        }
        entry = dashNode
      }
      const childIdx = insertChars(entry, part)
      flatten(child, childIdx, false)
    }
  }
  flatten(partRoot, 0, true)

  // ---- radix-collapse chains ----
  const litAnchorSet = new Set(litEntries.map((e) => e.anchor))
  const annotated = (i: number): boolean =>
    charNodes[i]!.groupId >= 0 ||
    charNodes[i]!.vlist >= 0 ||
    litAnchorSet.has(i)

  interface RadixNode {
    edges: { label: string; oldTarget: number }[]
    groupId: number
    vlist: number
  }
  const oldToNew = new Map<number, number>()
  const radixNodes: RadixNode[] = []
  const buildRadix = (oldId: number): number => {
    const newId = radixNodes.length
    oldToNew.set(oldId, newId)
    const n: RadixNode = {
      edges: [],
      groupId: charNodes[oldId]!.groupId,
      vlist: charNodes[oldId]!.vlist,
    }
    radixNodes.push(n)
    const sorted = [...charNodes[oldId]!.edges.entries()].sort(
      (a, b) => a[0] - b[0]
    )
    for (const [c, t0] of sorted) {
      let label = String.fromCharCode(c)
      let t = t0
      while (charNodes[t]!.edges.size === 1 && !annotated(t)) {
        const [[c2, t2]] = charNodes[t]!.edges.entries() as unknown as [
          [number, number],
        ]
        label += String.fromCharCode(c2)
        t = t2
      }
      n.edges.push({ label, oldTarget: t })
    }
    for (const e of n.edges) buildRadix(e.oldTarget)
    return newId
  }
  buildRadix(0)
  const nodeCount = radixNodes.length
  let totalEdges = 0
  for (const n of radixNodes) totalEdges += n.edges.length

  const edgeCounts = new Int32Array(nodeCount)
  const edgeLabelLen = new Int32Array(totalEdges)
  let labelText = ""
  const nodeGroup = new Int32Array(nodeCount)
  const nodeVlist = new Int32Array(nodeCount)
  const edgeTargetActual: number[] = []
  {
    let e = 0
    for (let i = 0; i < nodeCount; i++) {
      const n = radixNodes[i]!
      edgeCounts[i] = n.edges.length
      for (const edge of n.edges) {
        edgeLabelLen[e] = edge.label.length
        labelText += edge.label
        edgeTargetActual.push(oldToNew.get(edge.oldTarget)!)
        e++
      }
      nodeGroup[i] = n.groupId
      nodeVlist[i] = n.vlist
    }
  }
  // verify: pre-order tree ⇒ targets derivable from edge counts alone
  {
    const sizes = new Int32Array(nodeCount)
    for (let i = nodeCount - 1; i >= 0; i--) {
      let s = 1
      let c = i + 1
      for (let k = 0; k < edgeCounts[i]!; k++) {
        s += sizes[c]!
        c += sizes[c]!
      }
      sizes[i] = s
    }
    let e = 0
    for (let i = 0; i < nodeCount; i++) {
      let c = i + 1
      for (let k = 0; k < edgeCounts[i]!; k++) {
        if (c !== edgeTargetActual[e])
          throw new Error(`cn compiler: edge target mismatch at ${e}`)
        c += sizes[c]!
        e++
      }
    }
  }
  // remap lit anchors to radix node ids
  for (const en of litEntries) en.anchor = oldToNew.get(en.anchor)!

  // reorder vlist ids by first use in node order (ascending sparse stream)
  {
    const newId = new Int32Array(vlists.length).fill(-1)
    const order: [number, number][][] = []
    for (let i = 0; i < nodeCount; i++) {
      const v = nodeVlist[i]!
      if (v >= 0) {
        if (newId[v] === -1) {
          newId[v] = order.length
          order.push(vlists[v]!)
        }
        nodeVlist[i] = newId[v]!
      }
    }
    vlists.length = 0
    vlists.push(...order)
  }

  let totalV = 0
  for (const l of vlists) totalV += l.length
  const vlistValidator = new Int32Array(totalV)
  const vlistGroup = new Int32Array(totalV)
  {
    let v = 0
    for (const l of vlists)
      for (const [vid, gid] of l) {
        vlistValidator[v] = vid
        vlistGroup[v] = gid
        v++
      }
  }

  // ---- literal entries → tail sets + attachments ----
  litEntries.sort(
    (a, b) => a.anchor - b.anchor || a.gid - b.gid || (a.tail < b.tail ? -1 : 1)
  )
  interface Attachment {
    anchor: number
    gid: number
    tails: string[]
    set: number
  }
  const attachments: Attachment[] = []
  for (const e of litEntries) {
    const last = attachments[attachments.length - 1]
    if (last && last.anchor === e.anchor && last.gid === e.gid)
      last.tails.push(e.tail)
    else
      attachments.push({
        anchor: e.anchor,
        gid: e.gid,
        tails: [e.tail],
        set: -1,
      })
  }
  const setIndex = new Map<string, number>()
  const sets: string[][] = []
  for (const a of attachments) {
    const key = a.tails.join(" ")
    let s = setIndex.get(key)
    if (s === undefined) {
      s = sets.length
      setIndex.set(key, s)
      sets.push(a.tails)
    }
    a.set = s
  }
  for (const s of sets.flat()) {
    if (s.includes("|") || s.includes(" "))
      throw new Error("cn compiler: tail contains delimiter: " + s)
  }
  const uniqueTailCount = new Set(sets.flat()).size
  attachments.sort((x, y) => x.anchor - y.anchor || x.set - y.set)

  // ---- renumber group ids by first emission ----
  for (const targets of Object.values(config.conflictingClassGroups))
    for (const n of targets) groupId(n)
  for (const targets of Object.values(config.conflictingClassGroupModifiers))
    for (const n of targets) groupId(n)
  for (const n of config.postfixLookupClassGroups ?? []) groupId(n)
  const G = groupNames.length
  const remap = new Int32Array(G).fill(-1)
  let nextNewGid = 0
  const renum = (old: number): number => {
    if (remap[old] === -1) remap[old] = nextNewGid++
    return remap[old]!
  }
  for (let i = 0; i < vlistGroup.length; i++)
    vlistGroup[i] = renum(vlistGroup[i]!)
  for (const a of attachments) a.gid = renum(a.gid)
  for (let i = 0; i < nodeGroup.length; i++)
    if (nodeGroup[i]! >= 0) nodeGroup[i] = renum(nodeGroup[i]!)
  for (let g = 0; g < G; g++) if (remap[g] === -1) remap[g] = nextNewGid++
  const newGroupName: string[] = new Array(G)
  for (let g = 0; g < G; g++) newGroupName[remap[g]!] = groupNames[g]!
  // litEntries carry pre-renumber gids; rebuild them from attachments below

  // ---- conflict adjacency ----
  const adjGid: number[] = []
  const adjCnt: number[] = []
  const adjTgt: number[] = []
  const patGid: number[] = []
  const patTgt: number[] = []
  for (let ng = 0; ng < G; ng++) {
    const name = newGroupName[ng]!
    const base = (config.conflictingClassGroups[name] ?? []).map(
      (n) => remap[groupIdByName.get(n)!]!
    )
    const mod = (config.conflictingClassGroupModifiers[name] ?? []).map(
      (n) => remap[groupIdByName.get(n)!]!
    )
    if (base.length) {
      adjGid.push(ng)
      adjCnt.push(base.length)
      adjTgt.push(...base)
    }
    for (const m2 of mod) {
      patGid.push(ng)
      patTgt.push(m2)
    }
  }
  const postfixLookup = (config.postfixLookupClassGroups ?? []).map(
    (n) => remap[groupIdByName.get(n)!]!
  )

  // ---- validator opcodes ----
  const customNames: string[] = []
  const vlistOp = new Int32Array(vlistValidator.length)
  for (let i = 0; i < vlistValidator.length; i++) {
    const name = reg.names[vlistValidator[i]!]!
    const op = OPS[name]
    if (op !== undefined) vlistOp[i] = op
    else {
      let ci = customNames.indexOf(name)
      if (ci === -1) {
        ci = customNames.length
        customNames.push(name)
      }
      vlistOp[i] = CUSTOM_OP_BASE + ci
    }
  }
  // factor op sequences into patterns
  const patIndex = new Map<string, number>()
  const patCounts: number[] = []
  const patOps: number[] = []
  const listPat: number[] = []
  {
    let k = 0
    for (const l of vlists) {
      const ops: number[] = []
      for (let j = 0; j < l.length; j++) ops.push(vlistOp[k++]!)
      const key = ops.join(",")
      let p = patIndex.get(key)
      if (p === undefined) {
        p = patCounts.length
        patIndex.set(key, p)
        patCounts.push(ops.length)
        patOps.push(...ops)
      }
      listPat.push(p)
    }
  }

  const impls: ValidatorImpls = {}
  for (const name of customNames) impls[name] = reg.classifierFns.get(name)!

  return {
    G,
    customNames,
    impls,
    edgeCounts,
    edgeLabelLen,
    labelText,
    edgeTargetActual,
    nodeGroup,
    nodeVlist,
    nodeCount,
    totalEdges,
    patCounts,
    patOps,
    listPat,
    vlistGroup,
    litEntries,
    sets,
    attachments,
    uniqueTailCount,
    adjGid,
    adjCnt,
    adjTgt,
    patGid,
    patTgt,
    postfixLookup,
    orderSensitiveModifiers: config.orderSensitiveModifiers.join(" "),
    prefix: config.prefix,
  }
}

