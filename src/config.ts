/**
 * Advanced Tailwind merge configuration for `cn`.
 *
 * Kept behind a subpath so the compiler/default-config data does not enter
 * the normal `@obvia/cv` bundle graph.
 */
export {
  createCn,
  createTwMerge,
  defaultConfig,
  extendTailwindMerge,
  fromTheme,
  mergeConfigs,
  validators,
} from "./merge/config.js";

export type {
  CnConfig,
  ClassGroupDef,
  ConfigExtension,
  CreateCnInput,
  DefaultClassGroupIds,
  DefaultThemeGroupIds,
} from "./merge/config.js";
