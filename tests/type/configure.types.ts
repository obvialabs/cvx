import { configure } from "../../src/index";

const stringOnly = (...inputs: string[]) => inputs.join(" ");
const customCn = (...inputs: string[]) => inputs.join("+");

const configured = configure({ cx: stringOnly, cn: customCn, compileLimit: 0 });
const component = configured.cv({
  base: "base",
  variants: { tone: { a: "a", b: "b" } },
  defaultVariants: { tone: "a" },
});

component({ tone: "b", class: "tail" });
configured.cx("a", "b");
configured.cn("a", "b");

// @ts-expect-error custom cx narrows authored classes to strings
configured.cv({ base: ["not", "allowed"] });
// @ts-expect-error custom cx narrows runtime class props to strings
component({ className: ["not", "allowed"] });
// @ts-expect-error custom cn is string-only
configured.cn(["not", "allowed"]);

const defaultConfigured = configure({ compileLimit: 1_024 });
defaultConfigured.cv({ base: ["arrays", { remain: true }] });
defaultConfigured.cx(["arrays", { remain: true }]);
defaultConfigured.cn(["arrays", { remain: true }]);
