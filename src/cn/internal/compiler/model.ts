import type { Tables, ValidatorImpls } from "../types"
import * as refValidators from "../validators"

import {
  cloneConfig,
  type ClassGroupDefinition,
  type CnConfig,
} from "./config"

/**
 * Return whether a class-group definition represents a compiler marker
 *
 * **Parameters**
 * - `definition` – Class-group definition object to inspect
 * - `key` – Marker property expected on the definition
 *
 * **Returns**
 * - `boolean` – `true` when the definition contains only the requested string marker
 */
const isMarker = (
    definition: object,
    key: string,
): boolean => {
  // Read enumerable keys once so both marker count and marker identity can be validated
  const keys = Object.keys(definition)

  return (
      keys.length === 1 &&
      keys[0] === key &&
      typeof (definition as never)[key] === "string"
  )
}

/**
 * Return whether a class-group function represents a marked theme getter
 *
 * **Parameters**
 * - `fn` – Candidate class-group definition to inspect
 *
 * **Returns**
 * - `boolean` – `true` when the value is a marked theme-getter function
 */
const isThemeGetterFn = (
    fn: unknown,
): fn is ((theme: object) => ClassGroupDefinition[]) & {
  isThemeGetter: true
} =>
    typeof fn === "function" &&
    (fn as { isThemeGetter?: boolean }).isThemeGetter === true

/**
 * Built-in validator names mapped to runtime validator opcodes
 */
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

/**
 * First opcode reserved for custom runtime validators
 */
const CUSTOM_OP_BASE = 25

/**
 * Mutable registry that assigns stable compiler identifiers to validator definitions
 */
interface ValidatorRegistry {
  /**
   * Ordered unique validator names, including opcode and generated custom names
   */
  names: string[]

  /**
   * Validator name mapped to its stable registry identifier
   */
  idByName: Map<string, number>

  /**
   * Custom validator implementations keyed by generated validator name
   */
  impls: ValidatorImpls

  /**
   * Custom validator function identities mapped to their generated names
   */
  fnName: Map<(value: string) => boolean, string>

  /**
   * Plain-string predicates used by compiler-side token classification
   */
  classifierFns: Map<string, (value: string) => boolean>
}

/**
 * Create an empty validator registry for one compiler invocation
 *
 * **Returns**
 * - `ValidatorRegistry` – Independent mutable registry used during model compilation
 */
const newRegistry = (): ValidatorRegistry => ({
  names: [],
  idByName: new Map(),
  impls: {},
  fnName: new Map(),
  classifierFns: new Map(),
})

/**
 * Resolve or allocate the stable registry identifier for a validator
 *
 * **Parameters**
 * - `registry` – Mutable validator registry for the current compilation
 * - `name` – Stable validator name
 * - `implementation` – Predicate used by compiler-side classification
 *
 * **Returns**
 * - `number` – Stable numeric identifier assigned to the validator
 */
const validatorIdFor = (
    registry: ValidatorRegistry,
    name: string,
    implementation: (value: string) => boolean,
): number => {
  let id = registry.idByName.get(name)

  // Register previously unseen validators in deterministic encounter order
  if (id === undefined) {
    id = registry.names.length

    registry.names.push(name)
    registry.idByName.set(name, id)
    registry.classifierFns.set(
        name,
        implementation,
    )
  }

  return id
}

/**
 * Resolve a validator definition to its compiler registry identifier
 *
 * **Parameters**
 * - `registry` – Mutable validator registry for the current compilation
 * - `definition` – Named validator marker or custom validator function
 *
 * **Returns**
 * - `number` – Stable registry identifier assigned to the validator
 */
const resolveValidator = (
    registry: ValidatorRegistry,
    definition:
        | { $v: string }
        | ((value: string) => boolean),
): number => {
  // Custom functions require generated names because no stable authored name exists
  if (typeof definition === "function") {
    let name = registry.fnName.get(definition)

    if (name === undefined) {
      name = "$c" + registry.fnName.size

      registry.fnName.set(
          definition,
          name,
      )

      registry.impls[name] = definition
    }

    return validatorIdFor(
        registry,
        name,
        definition,
    )
  }

  const name = definition.$v
  const reference = (
      refValidators as unknown as Record<
          string,
          (value: string) => boolean
      >
  )[name]

  // Named markers must resolve to validators supported by both compiler and runtime
  if (
      OPS[name] === undefined ||
      !reference
  ) {
    throw new Error(
        `cn: unknown validator "${name}"`,
    )
  }

  return validatorIdFor(
      registry,
      name,
      reference,
  )
}

/**
 * Logical utility-part trie used before character-level radix compaction
 */
interface PartNode {
  /**
   * Child nodes keyed by dash-separated utility part
   */
  nextPart: Map<string, PartNode>

  /**
   * Validator/group pairs evaluated when no literal child resolves
   */
  validators: {
    validatorId: number
    groupId: number
  }[] | null

  /**
   * Conflict group resolved when the current utility path ends at this node
   */
  classGroupId: number

  /**
   * Literal tails lifted from fully static subtrees
   */
  lit: {
    tail: string
    gid: number
  }[]
}

/**
 * Create an empty logical utility-part trie node
 *
 * **Returns**
 * - `PartNode` – Mutable trie node initialized without children, validators, or a resolved group
 */
const newPartNode = (): PartNode => ({
  nextPart: new Map(),
  validators: null,
  classGroupId: -1,
  lit: [],
})

/**
 * Expand one theme reference into its configured class-group definitions
 *
 * **Parameters**
 * - `config` – Normalized conflict configuration containing theme values
 * - `key` – Theme key referenced by the class-group definition
 *
 * **Returns**
 * - `ClassGroupDefinition[]` – Definitions registered for the theme key, or an empty collection when absent
 */
const expandTheme = (
    config: CnConfig,
    key: string,
): readonly ClassGroupDefinition[] =>
    config.theme[key] ?? []

/**
 * Build the logical dash-separated utility trie for a conflict configuration
 *
 * **Parameters**
 * - `config` – Normalized conflict configuration to classify
 * - `registry` – Validator registry shared by the current compilation
 * - `groupId` – Resolver that maps authored group names to stable numeric identifiers
 *
 * **Returns**
 * - `PartNode` – Root node of the logical utility-part trie
 */
const buildPartTrie = (
    config: CnConfig,
    registry: ValidatorRegistry,
    groupId: (name: string) => number,
): PartNode => {
  const root = newPartNode()

  /**
   * Resolve or create a dash-separated path below one trie node
   *
   * **Parameters**
   * - `node` – Trie node from which traversal should begin
   * - `path` – Dash-separated utility path to create
   *
   * **Returns**
   * - `PartNode` – Final node representing the complete utility path
   */
  const getPart = (
      node: PartNode,
      path: string,
  ): PartNode => {
    // Create each missing utility segment while walking the authored path
    for (const part of path.split("-")) {
      let next = node.nextPart.get(part)

      if (!next) {
        next = newPartNode()

        node.nextPart.set(
            part,
            next,
        )
      }

      node = next
    }

    return node
  }

  /**
   * Apply one class-group definition to a logical trie node
   *
   * **Parameters**
   * - `definition` – Literal, validator, marker, theme getter, or nested class-group definition
   * - `node` – Trie node at which the definition should be applied
   * - `gid` – Numeric conflict-group identifier associated with the definition
   *
   * **Returns**
   * - `void` – Mutates the logical trie without returning a value
   */
  const process = (
      definition: ClassGroupDefinition,
      node: PartNode,
      gid: number,
  ): void => {
    // Literal strings extend the trie and terminate in the current conflict group
    if (typeof definition === "string") {
      const target =
          definition === ""
              ? node
              : getPart(
                  node,
                  definition,
              )

      target.classGroupId = gid
      return
    }

    // Functions are either compile-time theme getters or runtime validators
    if (typeof definition === "function") {
      if (isThemeGetterFn(definition)) {
        for (const inner of definition(config.theme)) {
          process(
              inner,
              node,
              gid,
          )
        }

        return
      }

      // Dynamic predicates remain attached to the current trie position
      ;(node.validators ??= []).push({
        validatorId: resolveValidator(
            registry,
            definition,
        ),
        groupId: gid,
      })

      return
    }

    // Theme markers inline the referenced theme definitions at the current node
    if (
        isMarker(
            definition,
            "$t",
        )
    ) {
      for (
          const inner of expandTheme(
          config,
          (definition as { $t: string }).$t,
      )
          ) {
        process(
            inner,
            node,
            gid,
        )
      }

      return
    }

    // Validator markers attach one known validator to the current trie position
    if (
        isMarker(
            definition,
            "$v",
        )
    ) {
      ;(node.validators ??= []).push({
        validatorId: resolveValidator(
            registry,
            definition as { $v: string },
        ),
        groupId: gid,
      })

      return
    }

    // Nested objects create additional dash-separated utility paths
    for (
        const [key, value] of Object.entries(
        definition as {
          [key: string]: readonly ClassGroupDefinition[]
        },
    )
        ) {
      const child = getPart(
          node,
          key,
      )

      for (const inner of value) {
        process(
            inner,
            child,
            gid,
        )
      }
    }
  }

  // Insert every configured class group into the logical trie
  for (
      const [name, group] of Object.entries(
      config.classGroups,
  )
      ) {
    const gid = groupId(name)

    for (const definition of group) {
      process(
          definition,
          root,
          gid,
      )
    }
  }

  return root
}

/**
 * Result of reducing a conflict configuration to groups used by a token corpus
 */
export interface SubsetResult {
  /**
   * Reduced conflict configuration containing retained groups and relationships
   */
  config: CnConfig

  /**
   * Number of class groups retained by corpus analysis
   */
  usedGroups: number

  /**
   * Number of class groups present before subsetting
   */
  totalGroups: number
}

/**
 * Reduce a conflict configuration to class groups required by a token corpus
 *
 * **Parameters**
 * - `base` – Full normalized conflict configuration
 * - `tokens` – Utility tokens used to discover reachable class groups
 *
 * **Returns**
 * - `SubsetResult` – Reduced configuration together with retained and original group counts
 *
 * @internal
 */
export const subsetConfig = (
    base: CnConfig,
    tokens: Iterable<string>,
): SubsetResult => {
  // Work on a clone so corpus reduction never mutates the caller's configuration
  const config = cloneConfig(base)

  // Build an isolated validator registry for corpus-side utility classification
  const registry = newRegistry()

  const groupNames: string[] = []
  const idByName = new Map<string, number>()

  /**
   * Resolve or allocate the numeric identifier for a conflict-group name
   *
   * **Parameters**
   * - `name` – Authored conflict-group name
   *
   * **Returns**
   * - `number` – Stable numeric identifier for the current corpus analysis
   */
  const gidOf = (
      name: string,
  ): number => {
    let id = idByName.get(name)

    if (id === undefined) {
      id = groupNames.length

      groupNames.push(name)
      idByName.set(
          name,
          id,
      )
    }

    return id
  }

  // Build the logical trie before literal lifting so all authored groups remain visible
  const root = buildPartTrie(
      config,
      registry,
      gidOf,
  )

  /**
   * Classify one split utility path against the logical trie
   *
   * Literal children are preferred. When no literal path resolves, validators
   * attached to the current node are evaluated against the remaining suffix.
   *
   * **Parameters**
   * - `parts` – Dash-separated utility parts
   * - `index` – Current part position
   * - `node` – Logical trie node currently being evaluated
   *
   * **Returns**
   * - `number` – Resolved group identifier, or `-1` when no group matches
   */
  const walk = (
      parts: string[],
      index: number,
      node: PartNode,
  ): number => {
    // Return the terminal group when the complete utility path has been consumed
    if (index === parts.length) {
      return node.classGroupId
    }

    const next = node.nextPart.get(
        parts[index]!,
    )

    // Prefer literal trie traversal before evaluating dynamic validators
    if (next) {
      const resolved = walk(
          parts,
          index + 1,
          next,
      )

      if (resolved >= 0) {
        return resolved
      }
    }

    // Corpus subsetting intentionally runs before literal lifting, so only validators remain here
    if (!node.validators) {
      return -1
    }

    // Reconstruct the unresolved suffix exactly as runtime validators receive it
    const rest = parts
        .slice(index)
        .join("-")

    for (
        const {
          validatorId,
          groupId,
        } of node.validators
        ) {
      const validator =
          registry.classifierFns.get(
              registry.names[validatorId]!,
          )!

      if (validator(rest)) {
        return groupId
      }
    }

    return -1
  }

  /**
   * Classify one bare utility name against the logical trie
   *
   * **Parameters**
   * - `bareBase` – Utility without variants, important markers, or postfix modifiers
   *
   * **Returns**
   * - `number` – Resolved group identifier, or `-1` for dynamic or unknown utilities
   */
  const classify = (
      bareBase: string,
  ): number => {
    // Arbitrary properties create dynamic groups at runtime and therefore retain no static group
    if (
        bareBase.startsWith("[") &&
        bareBase.endsWith("]")
    ) {
      return -1
    }

    const parts = bareBase.split("-")

    // Negative utilities begin with an empty split segment that is not part of the trie
    return walk(
        parts,
        parts[0] === "" &&
        parts.length > 1
            ? 1
            : 0,
        root,
    )
  }

  // Normalize the configured prefix into the token form used by Tailwind utilities
  const prefix =
      config.prefix
          ? config.prefix + ":"
          : null

  const used = new Set<string>()

  // Classify every token in the supplied corpus
  for (let token of tokens) {
    // Ignore empty corpus entries
    if (!token) {
      continue
    }

    // Ignore utilities that do not use the configured Tailwind prefix
    if (prefix) {
      if (!token.startsWith(prefix)) {
        continue
      }

      token = token.slice(
          prefix.length,
      )
    }

    let bracketDepth = 0
    let parenthesisDepth = 0
    let lastColon = -1
    let lastSlash = -1

    // Locate top-level modifier boundaries without splitting arbitrary expressions
    for (let index = 0; index < token.length; index++) {
      const character = token[index]

      if (
          bracketDepth === 0 &&
          parenthesisDepth === 0
      ) {
        if (character === ":") {
          lastColon = index
        } else if (character === "/") {
          lastSlash = index
        }
      }

      // Track square-bracket nesting used by arbitrary values and properties
      if (character === "[") {
        bracketDepth++
      } else if (character === "]") {
        bracketDepth--
      } else if (character === "(") {
        parenthesisDepth++
      } else if (character === ")") {
        parenthesisDepth--
      }
    }

    // Remove variant prefixes from the utility before classification
    let bare = token.slice(
        lastColon + 1,
    )

    // Normalize both supported important-modifier positions
    if (bare.endsWith("!")) {
      bare = bare.slice(
          0,
          -1,
      )
    } else if (bare.startsWith("!")) {
      bare = bare.slice(1)
    }

    // Postfix-modifier utilities are classified both with and without the postfix segment
    const candidates =
        lastSlash > lastColon
            ? [
              bare,
              token
                  .slice(
                      lastColon + 1,
                      lastSlash,
                  )
                  .replace(
                      /^!/,
                      "",
                  ),
            ]
            : [bare]

    // Retain every conflict group reachable from one of the normalized candidates
    for (const candidate of candidates) {
      const group = classify(candidate)

      if (group >= 0) {
        used.add(
            groupNames[group]!,
        )
      }
    }
  }

  // Preserve the original group count for diagnostics before removing unused groups
  const totalGroups =
      Object.keys(config.classGroups).length

  // Remove class groups that cannot be reached by the supplied corpus
  for (
      const key of Object.keys(
      config.classGroups,
  )
      ) {
    if (!used.has(key)) {
      delete config.classGroups[key]
    }
  }

  // Remove ordinary conflict relationships whose source groups were removed
  for (
      const key of Object.keys(
      config.conflictingClassGroups,
  )
      ) {
    if (!used.has(key)) {
      delete config.conflictingClassGroups[key]
    }
  }

  // Remove postfix conflict relationships whose source groups were removed
  for (
      const key of Object.keys(
      config.conflictingClassGroupModifiers,
  )
      ) {
    if (!used.has(key)) {
      delete config.conflictingClassGroupModifiers[key]
    }
  }

  return {
    config,
    usedGroups: used.size,
    totalGroups,
  }
}

/**
 * Normalized intermediate representation produced before table packing
 */
export interface CompiledModel {
  /**
   * Number of compiled conflict groups
   */
  G: number

  /**
   * Custom validator names retained for runtime implementation lookup
   */
  customNames: string[]

  /**
   * Runtime implementations for custom validators
   */
  impls: ValidatorImpls

  /**
   * Outgoing radix-edge count for each node
   */
  edgeCounts: Int32Array

  /**
   * Character length of every radix-edge label
   */
  edgeLabelLen: Int32Array

  /**
   * Concatenated radix-edge labels
   */
  labelText: string

  /**
   * Target node for every emitted radix edge
   */
  edgeTargetActual: number[]

  /**
   * Conflict-group identifier encoded at each node
   */
  nodeGroup: Int32Array

  /**
   * Validator-list identifier encoded at each node
   */
  nodeVlist: Int32Array

  /**
   * Total number of emitted radix nodes
   */
  nodeCount: number

  /**
   * Total number of emitted radix edges
   */
  totalEdges: number

  /**
   * Validator-opcode count for every deduplicated pattern
   */
  patCounts: number[]

  /**
   * Flattened validator opcodes
   */
  patOps: number[]

  /**
   * Validator pattern reference for every validator list
   */
  listPat: number[]

  /**
   * Flattened conflict-group identifiers associated with validator lists
   */
  vlistGroup: Int32Array

  /**
   * Lifted literal entries before string-pool packing
   */
  litEntries: {
    anchor: number
    tail: string
    gid: number
  }[]

  /**
   * Deduplicated lifted-literal tail sets
   */
  sets: string[][]

  /**
   * Literal-set attachments mapped to trie anchors and groups
   */
  attachments: {
    anchor: number
    gid: number
    set: number
  }[]

  /**
   * Number of unique literal tails retained after deduplication
   */
  uniqueTailCount: number

  /**
   * Source conflict group for every adjacency row
   */
  adjGid: number[]

  /**
   * Target-count metadata for every adjacency row
   */
  adjCnt: number[]

  /**
   * Flattened adjacency targets
   */
  adjTgt: number[]

  /**
   * Source groups participating in postfix-specific conflicts
   */
  patGid: number[]

  /**
   * Target groups for postfix-specific conflicts
   */
  patTgt: number[]

  /**
   * Groups requiring a postfix-aware secondary lookup
   */
  postfixLookup: number[]

  /**
   * Space-delimited modifier names whose authored order must be preserved
   */
  orderSensitiveModifiers: string

  /**
   * Optional Tailwind v4 utility prefix
   */
  prefix?: string
}

/**
 * Compile normalized configuration into the shared intermediate conflict model
 *
 * **Parameters**
 * - `config` – Complete normalized conflict configuration
 *
 * **Returns**
 * - `CompiledModel` – Deterministic intermediate data used by table and source emitters
 */
export const compileModel = (
    config: CnConfig,
): CompiledModel => {
  // Create an isolated validator registry for this compilation
  const registry = newRegistry()

  const groupNames: string[] = []
  const groupIdByName = new Map<string, number>()

  /**
   * Resolve or allocate the compiler identifier for one conflict-group name
   *
   * **Parameters**
   * - `name` – Authored conflict-group name
   *
   * **Returns**
   * - `number` – Stable numeric identifier assigned during model construction
   */
  const groupId = (
      name: string,
  ): number => {
    let id = groupIdByName.get(name)

    if (id === undefined) {
      id = groupNames.length

      groupNames.push(name)
      groupIdByName.set(
          name,
          id,
      )
    }

    return id
  }

  // Build the logical utility trie before literal lifting and radix compaction
  const partRoot = buildPartTrie(
      config,
      registry,
      groupId,
  )

  /**
   * Return whether a logical trie subtree contains only static literal paths
   *
   * Nodes containing validators cannot be lifted because their suffixes require
   * runtime evaluation.
   *
   * **Parameters**
   * - `node` – Logical trie node whose subtree should be inspected
   *
   * **Returns**
   * - `boolean` – `true` when the complete subtree can be represented as lifted literals
   */
  const isLiftable = (
      node: PartNode,
  ): boolean => {
    // Dynamic validator branches must remain in the runtime trie
    if (node.validators) {
      return false
    }

    // Every descendant must also be fully static
    for (const child of node.nextPart.values()) {
      if (!isLiftable(child)) {
        return false
      }
    }

    return true
  }

  /**
   * Collect every terminal utility below a liftable subtree
   *
   * **Parameters**
   * - `node` – Current logical trie node
   * - `prefix` – Literal utility suffix accumulated from the lift root
   * - `output` – Mutable collection receiving lifted literal entries
   *
   * **Returns**
   * - `void` – Appends discovered literal tails to `output` without returning a value
   */
  const collectLifted = (
      node: PartNode,
      prefix: string,
      output: {
        tail: string
        gid: number
      }[],
  ): void => {
    // Preserve a terminal conflict group at the current literal suffix
    if (node.classGroupId >= 0) {
      output.push({
        tail: prefix,
        gid: node.classGroupId,
      })
    }

    // Continue collecting every static descendant using dash-separated utility syntax
    for (
        const [part, child] of node.nextPart
        ) {
      collectLifted(
          child,
          prefix + "-" + part,
          output,
      )
    }
  }

  /**
   * Lift fully static child subtrees out of the logical trie
   *
   * **Parameters**
   * - `node` – Logical trie node whose children should be inspected
   *
   * **Returns**
   * - `void` – Mutates the logical trie and literal collections without returning a value
   */
  const pruneNode = (
      node: PartNode,
  ): void => {
    // Iterate over a snapshot because liftable children are removed during traversal
    for (
        const [part, child] of [
      ...node.nextPart,
    ]
        ) {
      if (isLiftable(child)) {
        // Preserve every static terminal before removing the subtree
        collectLifted(
            child,
            part,
            node.lit,
        )

        node.nextPart.delete(part)
      } else {
        // Continue searching dynamic subtrees for independently liftable descendants
        pruneNode(child)
      }
    }
  }

  // Remove fully static subtrees before character-level trie expansion
  pruneNode(partRoot)

  /**
   * Character-level trie node used before radix-edge compaction
   */
  interface CharNode {
    /**
     * Outgoing character code mapped to the target character node
     */
    edges: Map<number, number>

    /**
     * Conflict group resolved at this node, or `-1` when the path is incomplete
     */
    groupId: number

    /**
     * Validator-list identifier evaluated at this node, or `-1` when none applies
     */
    vlist: number
  }

  // Initialize the character trie with one root node
  const charNodes: CharNode[] = [
    {
      edges: new Map(),
      groupId: -1,
      vlist: -1,
    },
  ]

  /**
   * Append an empty character node and return its identifier
   *
   * **Returns**
   * - `number` – Index of the newly appended character node
   */
  const newCharNode = (): number => {
    charNodes.push({
      edges: new Map(),
      groupId: -1,
      vlist: -1,
    })

    return charNodes.length - 1
  }

  // Store validator/group sequences referenced by trie nodes
  const vlists: [number, number][][] = []

  // Deduplicate validator lists by their serialized validator/group sequence
  const vlistIndex = new Map<string, number>()

  /**
   * Intern one validator list and return its stable identifier
   *
   * **Parameters**
   * - `list` – Validator and group pairs attached to one logical trie node
   *
   * **Returns**
   * - `number` – Existing or newly assigned validator-list identifier
   */
  const internVlist = (
      list: {
        validatorId: number
        groupId: number
      }[],
  ): number => {
    // Serialize the small numeric sequence into a deterministic deduplication key
    const key = list
        .map(
            (entry) =>
                entry.validatorId +
                ":" +
                entry.groupId,
        )
        .join(",")

    let index = vlistIndex.get(key)

    if (index === undefined) {
      index = vlists.length

      // Copy the list into the compact tuple representation used by later stages
      vlists.push(
          list.map(
              (entry) => [
                entry.validatorId,
                entry.groupId,
              ],
          ),
      )

      vlistIndex.set(
          key,
          index,
      )
    }

    return index
  }

  /**
   * Insert a string into the character trie from an existing node
   *
   * **Parameters**
   * - `fromIndex` – Character node from which insertion should begin
   * - `value` – String whose characters should be inserted
   *
   * **Returns**
   * - `number` – Character-node identifier representing the final character
   */
  const insertChars = (
      fromIndex: number,
      value: string,
  ): number => {
    let current = fromIndex

    // Walk or create one trie edge for every character in the string
    for (
        let index = 0;
        index < value.length;
        index++
    ) {
      const code = value.charCodeAt(index)
      let next =
          charNodes[current]!.edges.get(code)

      if (next === undefined) {
        next = newCharNode()

        charNodes[current]!.edges.set(
            code,
            next,
        )
      }

      current = next
    }

    return current
  }

  /**
   * Character code used for dash separators between utility parts
   *
   * @internal
   */
  const DASH = 45

  // Collect lifted literals using character-node anchors before radix compaction
  const litEntries: {
    anchor: number
    tail: string
    gid: number
  }[] = []

  /**
   * Expand the logical part trie into the character-level trie
   *
   * **Parameters**
   * - `partNode` – Logical utility-part node being expanded
   * - `charIndex` – Character-node identifier representing the current path
   * - `isRoot` – Whether the logical node is the trie root
   *
   * **Returns**
   * - `void` – Mutates the character trie and literal collection without returning a value
   */
  const flatten = (
      partNode: PartNode,
      charIndex: number,
      isRoot: boolean,
  ): void => {
    // Preserve terminal conflict groups on the corresponding character node
    if (partNode.classGroupId >= 0) {
      charNodes[charIndex]!.groupId =
          partNode.classGroupId
    }

    // Intern and attach dynamic validators when the logical node defines them
    if (partNode.validators) {
      charNodes[charIndex]!.vlist =
          internVlist(
              partNode.validators,
          )
    }

    // Attach lifted literal tails to the current character-node anchor
    for (
        const {
          tail,
          gid,
        } of partNode.lit
        ) {
      litEntries.push({
        anchor: charIndex,
        tail,
        gid,
      })
    }

    // Expand remaining logical children into character-level paths
    for (
        const [part, child] of partNode.nextPart
        ) {
      let entry = charIndex

      // Non-root utility parts require an explicit dash separator
      if (!isRoot) {
        let dashNode =
            charNodes[charIndex]!.edges.get(
                DASH,
            )

        if (dashNode === undefined) {
          dashNode = newCharNode()

          charNodes[charIndex]!.edges.set(
              DASH,
              dashNode,
          )
        }

        entry = dashNode
      }

      // Insert the utility part and recursively expand its descendants
      const childIndex = insertChars(
          entry,
          part,
      )

      flatten(
          child,
          childIndex,
          false,
      )
    }
  }

  // Materialize the complete retained utility trie at character granularity
  flatten(
      partRoot,
      0,
      true,
  )

  // Track nodes that cannot be collapsed because runtime metadata references them
  const literalAnchorSet = new Set(
      litEntries.map(
          (entry) => entry.anchor,
      ),
  )

  /**
   * Return whether a character node carries runtime-visible metadata
   *
   * **Parameters**
   * - `index` – Character-node identifier to inspect
   *
   * **Returns**
   * - `boolean` – `true` when the node must remain addressable after radix compaction
   */
  const annotated = (
      index: number,
  ): boolean =>
      charNodes[index]!.groupId >= 0 ||
      charNodes[index]!.vlist >= 0 ||
      literalAnchorSet.has(index)

  /**
   * Compact radix-trie node produced from character-level chains
   *
   * @internal
   */
  interface RadixNode {
    /**
     * Compact edge labels and their source character-node targets
     */
    edges: {
      label: string
      oldTarget: number
    }[]

    /**
     * Conflict group resolved at this radix node
     */
    groupId: number

    /**
     * Validator-list identifier evaluated at this radix node
     */
    vlist: number
  }

  // Map original character-node identifiers to compact radix-node identifiers
  const oldToNew = new Map<
      number,
      number
  >()

  const radixNodes: RadixNode[] = []

  /**
   * Convert one character node and its descendants into compact radix nodes
   *
   * **Parameters**
   * - `oldId` – Character-node identifier to convert
   *
   * **Returns**
   * - `number` – Newly assigned radix-node identifier
   */
  const buildRadix = (
      oldId: number,
  ): number => {
    const newId = radixNodes.length

    oldToNew.set(
        oldId,
        newId,
    )

    const node: RadixNode = {
      edges: [],
      groupId:
      charNodes[oldId]!.groupId,
      vlist:
      charNodes[oldId]!.vlist,
    }

    radixNodes.push(node)

    // Sort outgoing edges by character code to guarantee deterministic compilation
    const sorted = [
      ...charNodes[oldId]!.edges.entries(),
    ].sort(
        (left, right) =>
            left[0] - right[0],
    )

    for (
        const [code, initialTarget] of sorted
        ) {
      let label =
          String.fromCharCode(code)

      let target = initialTarget

      // Collapse single-child chains until a branch or annotated node is reached
      while (
          charNodes[target]!.edges.size === 1 &&
          !annotated(target)
          ) {
        const [[nextCode, nextTarget]] =
            charNodes[target]!.edges.entries() as unknown as [
              [number, number],
            ]

        label +=
            String.fromCharCode(nextCode)

        target = nextTarget
      }

      node.edges.push({
        label,
        oldTarget: target,
      })
    }

    // Emit child radix nodes in edge order so pre-order layout remains deterministic
    for (const edge of node.edges) {
      buildRadix(edge.oldTarget)
    }

    return newId
  }

  // Compact the complete character trie starting at its root
  buildRadix(0)

  const nodeCount = radixNodes.length

  // Count emitted edges before allocating exact-size edge arrays
  let totalEdges = 0

  for (const node of radixNodes) {
    totalEdges += node.edges.length
  }

  // Allocate compact radix metadata using exact model sizes
  const edgeCounts =
      new Int32Array(nodeCount)

  const edgeLabelLen =
      new Int32Array(totalEdges)

  let labelText = ""

  const nodeGroup =
      new Int32Array(nodeCount)

  const nodeVlist =
      new Int32Array(nodeCount)

  const edgeTargetActual: number[] = []

  {
    let edgeIndex = 0

    // Flatten radix-node metadata into contiguous runtime-friendly arrays
    for (
        let nodeIndex = 0;
        nodeIndex < nodeCount;
        nodeIndex++
    ) {
      const node =
          radixNodes[nodeIndex]!

      edgeCounts[nodeIndex] =
          node.edges.length

      for (const edge of node.edges) {
        edgeLabelLen[edgeIndex] =
            edge.label.length

        labelText += edge.label

        edgeTargetActual.push(
            oldToNew.get(
                edge.oldTarget,
            )!,
        )

        edgeIndex++
      }

      nodeGroup[nodeIndex] =
          node.groupId

      nodeVlist[nodeIndex] =
          node.vlist
    }
  }

  // Verify that pre-order emission makes every target derivable from edge counts alone
  {
    // Store subtree sizes so child positions can be reconstructed without explicit target tables
    const sizes =
        new Int32Array(nodeCount)

    // Calculate subtree sizes from the end of the pre-order sequence backwards
    for (
        let nodeIndex = nodeCount - 1;
        nodeIndex >= 0;
        nodeIndex--
    ) {
      let size = 1
      let childIndex =
          nodeIndex + 1

      for (
          let edgeIndex = 0;
          edgeIndex <
          edgeCounts[nodeIndex]!;
          edgeIndex++
      ) {
        size += sizes[childIndex]!
        childIndex +=
            sizes[childIndex]!
      }

      sizes[nodeIndex] = size
    }

    let emittedEdgeIndex = 0

    // Compare every reconstructed child target against the explicitly emitted target
    for (
        let nodeIndex = 0;
        nodeIndex < nodeCount;
        nodeIndex++
    ) {
      let childIndex =
          nodeIndex + 1

      for (
          let edgeIndex = 0;
          edgeIndex <
          edgeCounts[nodeIndex]!;
          edgeIndex++
      ) {
        if (
            childIndex !==
            edgeTargetActual[
                emittedEdgeIndex
                ]
        ) {
          throw new Error(
              `cn compiler: edge target mismatch at ${emittedEdgeIndex}`,
          )
        }

        childIndex +=
            sizes[childIndex]!

        emittedEdgeIndex++
      }
    }
  }

  // Remap lifted-literal anchors from character nodes to compact radix node identifiers
  for (const entry of litEntries) {
    entry.anchor =
        oldToNew.get(entry.anchor)!
  }

  // Reorder validator-list identifiers by first node use to keep emitted references compact
  {
    const newId =
        new Int32Array(
            vlists.length,
        ).fill(-1)

    const order:
        [number, number][][] = []

    // Assign new validator-list identifiers in first-use node order
    for (
        let nodeIndex = 0;
        nodeIndex < nodeCount;
        nodeIndex++
    ) {
      const validatorList =
          nodeVlist[nodeIndex]!

      if (validatorList >= 0) {
        if (
            newId[validatorList] === -1
        ) {
          newId[validatorList] =
              order.length

          order.push(
              vlists[validatorList]!,
          )
        }

        nodeVlist[nodeIndex] =
            newId[validatorList]!
      }
    }

    // Replace the original list order with the compact first-use order
    vlists.length = 0
    vlists.push(...order)
  }

  // Determine the exact flattened validator/group storage requirement
  let totalValidators = 0

  for (const list of vlists) {
    totalValidators += list.length
  }

  const vlistValidator =
      new Int32Array(totalValidators)

  const vlistGroup =
      new Int32Array(totalValidators)

  {
    let validatorIndex = 0

    // Flatten validator lists while preserving each validator/group pair
    for (const list of vlists) {
      for (
          const [
            validatorId,
            groupId,
          ] of list
          ) {
        vlistValidator[
            validatorIndex
            ] = validatorId

        vlistGroup[
            validatorIndex
            ] = groupId

        validatorIndex++
      }
    }
  }

  // Sort lifted literals so equal anchor/group pairs become contiguous
  litEntries.sort(
      (left, right) =>
          left.anchor - right.anchor ||
          left.gid - right.gid ||
          (
              left.tail < right.tail
                  ? -1
                  : 1
          ),
  )

  /**
   * Group of lifted literals attached to one radix node and conflict group
   */
  interface Attachment {
    /**
     * Radix node that owns the lifted literal set
     */
    anchor: number

    /**
     * Conflict group resolved by every tail in the attachment
     */
    gid: number

    /**
     * Literal tails attached to the same anchor/group pair
     */
    tails: string[]

    /**
     * Deduplicated literal-set identifier assigned during pooling
     */
    set: number
  }

  const attachments: Attachment[] = []

  // Group adjacent literal entries that share the same anchor and conflict group
  for (const entry of litEntries) {
    const last =
        attachments[
        attachments.length - 1
            ]

    if (
        last &&
        last.anchor === entry.anchor &&
        last.gid === entry.gid
    ) {
      last.tails.push(entry.tail)
    } else {
      attachments.push({
        anchor: entry.anchor,
        gid: entry.gid,
        tails: [entry.tail],
        set: -1,
      })
    }
  }

  // Deduplicate identical literal-tail collections across attachments
  const setIndex =
      new Map<string, number>()

  const sets: string[][] = []

  for (const attachment of attachments) {
    const key =
        attachment.tails.join(" ")

    let set = setIndex.get(key)

    if (set === undefined) {
      set = sets.length

      setIndex.set(
          key,
          set,
      )

      sets.push(
          attachment.tails,
      )
    }

    attachment.set = set
  }

  // Reject delimiters reserved by compact literal serialization
  for (const tail of sets.flat()) {
    if (
        tail.includes("|") ||
        tail.includes(" ")
    ) {
      throw new Error(
          "cn compiler: tail contains delimiter: " +
          tail,
      )
    }
  }

  // Count unique literal tails independently from deduplicated tail-set collections
  const uniqueTailCount =
      new Set(
          sets.flat(),
      ).size

  // Sort attachments by runtime lookup order
  attachments.sort(
      (left, right) =>
          left.anchor - right.anchor ||
          left.set - right.set,
  )

  // Ensure groups referenced only by conflict relationships also receive identifiers
  for (
      const targets of Object.values(
      config.conflictingClassGroups,
  )
      ) {
    for (const name of targets) {
      groupId(name)
    }
  }

  for (
      const targets of Object.values(
      config.conflictingClassGroupModifiers,
  )
      ) {
    for (const name of targets) {
      groupId(name)
    }
  }

  for (
      const name of
  config.postfixLookupClassGroups ??
  []
      ) {
    groupId(name)
  }

  const groupCount =
      groupNames.length

  // Map original group identifiers to dense runtime identifiers
  const remap =
      new Int32Array(
          groupCount,
      ).fill(-1)

  let nextGroupId = 0

  /**
   * Resolve the dense runtime identifier for one compiler conflict group
   *
   * **Parameters**
   * - `old` – Original compiler-side conflict-group identifier
   *
   * **Returns**
   * - `number` – Dense runtime conflict-group identifier
   */
  const renumber = (
      old: number,
  ): number => {
    if (remap[old] === -1) {
      remap[old] =
          nextGroupId++
    }

    return remap[old]!
  }

  // Renumber groups referenced by validator lists first
  for (
      let index = 0;
      index < vlistGroup.length;
      index++
  ) {
    vlistGroup[index] =
        renumber(
            vlistGroup[index]!,
        )
  }

  // Renumber groups referenced by lifted literal attachments
  for (const attachment of attachments) {
    attachment.gid =
        renumber(
            attachment.gid,
        )
  }

  // Renumber groups encoded directly on radix nodes
  for (
      let index = 0;
      index < nodeGroup.length;
      index++
  ) {
    if (nodeGroup[index]! >= 0) {
      nodeGroup[index] =
          renumber(
              nodeGroup[index]!,
          )
    }
  }

  // Assign identifiers to groups that were not encountered during first-emission passes
  for (
      let group = 0;
      group < groupCount;
      group++
  ) {
    if (remap[group] === -1) {
      remap[group] =
          nextGroupId++
    }
  }

  // Build the reverse runtime identifier to authored group-name mapping
  const newGroupName: string[] =
      new Array(groupCount)

  for (
      let group = 0;
      group < groupCount;
      group++
  ) {
    newGroupName[
        remap[group]!
        ] = groupNames[group]!
  }

  // Compile group conflicts into flat adjacency rows used by the runtime claim set
  const adjacencyGroups: number[] = []
  const adjacencyCounts: number[] = []
  const adjacencyTargets: number[] = []

  // Store postfix-specific conflict relationships separately from base adjacency
  const postfixGroups: number[] = []
  const postfixTargets: number[] = []

  // Emit conflicts in dense runtime group order
  for (
      let group = 0;
      group < groupCount;
      group++
  ) {
    const name =
        newGroupName[group]!

    // Resolve ordinary conflict targets to dense runtime identifiers
    const baseTargets = (
        config.conflictingClassGroups[
            name
            ] ?? []
    ).map(
        (target) =>
            remap[
                groupIdByName.get(
                    target,
                )!
                ]!,
    )

    // Resolve postfix-specific conflict targets to dense runtime identifiers
    const modifierTargets = (
        config.conflictingClassGroupModifiers[
            name
            ] ?? []
    ).map(
        (target) =>
            remap[
                groupIdByName.get(
                    target,
                )!
                ]!,
    )

    // Emit one adjacency row only when the source group has ordinary conflicts
    if (baseTargets.length) {
      adjacencyGroups.push(group)
      adjacencyCounts.push(
          baseTargets.length,
      )
      adjacencyTargets.push(
          ...baseTargets,
      )
    }

    // Emit postfix relationships as direct source-target pairs
    for (
        const target of modifierTargets
        ) {
      postfixGroups.push(group)
      postfixTargets.push(target)
    }
  }

  // Resolve groups requiring postfix-aware secondary lookup
  const postfixLookup = (
      config.postfixLookupClassGroups ??
      []
  ).map(
      (name) =>
          remap[
              groupIdByName.get(name)!
              ]!,
  )

  // Collect custom validator names that cannot use built-in runtime opcodes
  const customNames: string[] = []

  // Store the runtime opcode associated with every flattened validator entry
  const validatorOps =
      new Int32Array(
          vlistValidator.length,
      )

  for (
      let index = 0;
      index < vlistValidator.length;
      index++
  ) {
    const name =
        registry.names[
            vlistValidator[index]!
            ]!

    const opcode = OPS[name]

    if (opcode !== undefined) {
      // Built-in validators use their fixed runtime opcode directly
      validatorOps[index] =
          opcode
    } else {
      // Custom validators are indexed after the built-in opcode range
      let customIndex =
          customNames.indexOf(name)

      if (customIndex === -1) {
        customIndex =
            customNames.length

        customNames.push(name)
      }

      validatorOps[index] =
          CUSTOM_OP_BASE +
          customIndex
    }
  }

  // Deduplicate repeated validator-opcode sequences into reusable patterns
  const patternIndex =
      new Map<string, number>()

  const patternCounts: number[] = []
  const patternOps: number[] = []
  const listPattern: number[] = []

  {
    let validatorIndex = 0

    // Convert each validator list into a reusable opcode-pattern identifier
    for (const list of vlists) {
      const operations: number[] = []

      for (
          let index = 0;
          index < list.length;
          index++
      ) {
        operations.push(
            validatorOps[
                validatorIndex++
                ]!,
        )
      }

      const key =
          operations.join(",")

      let pattern =
          patternIndex.get(key)

      if (pattern === undefined) {
        pattern =
            patternCounts.length

        patternIndex.set(
            key,
            pattern,
        )

        patternCounts.push(
            operations.length,
        )

        patternOps.push(
            ...operations,
        )
      }

      listPattern.push(pattern)
    }
  }

  // Retain runtime implementations only for validators encoded as custom opcodes
  const implementations: ValidatorImpls = {}

  for (const name of customNames) {
    implementations[name] =
        registry.classifierFns.get(
            name,
        )!
  }

  // Return the deterministic intermediate model consumed by later compiler stages
  return {
    G: groupCount,
    customNames,
    impls: implementations,
    edgeCounts,
    edgeLabelLen,
    labelText,
    edgeTargetActual,
    nodeGroup,
    nodeVlist,
    nodeCount,
    totalEdges,
    patCounts: patternCounts,
    patOps: patternOps,
    listPat: listPattern,
    vlistGroup,
    litEntries,
    sets,
    attachments,
    uniqueTailCount,
    adjGid: adjacencyGroups,
    adjCnt: adjacencyCounts,
    adjTgt: adjacencyTargets,
    patGid: postfixGroups,
    patTgt: postfixTargets,
    postfixLookup,
    orderSensitiveModifiers:
        config.orderSensitiveModifiers.join(
            " ",
        ),
    prefix: config.prefix,
  }
}