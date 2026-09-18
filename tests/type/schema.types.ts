import { cv } from "../../src/index";
import { getSchema, type Schema } from "../../src/schema";

const component = cv({
  variants: {
    size: { 1: "one", 2: "two" },
    active: { true: "yes", false: "no" },
    tone: { soft: "soft", hard: "hard" },
    _internal: { on: "on" },
  },
  defaultVariants: { size: 2, active: false, tone: "soft", _internal: "on" },
});

const schema = getSchema(component);
const typed: Schema<typeof component> = schema;

const numeric: readonly (1 | 2)[] = typed.size.values;
const boolean: readonly boolean[] = typed.active.values;
const tone: readonly ("soft" | "hard")[] = typed.tone.values;
const defaultSize: 1 | 2 = typed.size.defaultValue;
const defaultActive: boolean = typed.active.defaultValue;

void numeric;
void boolean;
void tone;
void defaultSize;
void defaultActive;

// @ts-expect-error internal variants are intentionally omitted from schema
schema._internal;
