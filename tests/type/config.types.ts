import {
  createCn,
  createTwMerge,
  fromTheme,
  validators,
  type ConfigExtension,
} from "../../src/config";

const extension = {
  extend: {
    classGroups: {
      "font-size": [{ text: ["hero", "tiny", validators.isArbitraryLength] }],
      spacing: [{ gap: [fromTheme("spacing")] }],
    },
  },
} satisfies ConfigExtension;

const cn = createCn(extension);
const twMerge = createTwMerge(extension);

const merged: string = cn("text-sm", "text-hero");
const mergedTw: string = twMerge("p-2", "p-4");
void merged;
void mergedTw;

createCn((config) => config);

// @ts-expect-error malformed class-group definitions are rejected
const invalid: ConfigExtension = { extend: { classGroups: { x: [Symbol()] } } };
void invalid;
