/**
 * Internal compiler facade for the `cn` domain.
 *
 * @internal
 */
export { mergeConfigs } from "./config.js"
export type {
  ClassGroupDefinition,
  CnConfig,
  CnConfigExtension,
  CnConfigurationInput,
} from "./config.js"
export { compileToSource } from "./emitter.js"
export { compileModel, subsetConfig } from "./model.js"
export type { CompiledModel, SubsetResult } from "./model.js"
export { compileStats } from "./stats.js"
export type { CompileStats } from "./stats.js"
export { compileToTables } from "./tables.js"
export type { CompiledTables } from "./tables.js"
