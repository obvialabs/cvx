import { cv, type VariantProps } from "../../src/index";

const tone = cv({
  variants: { tone: { calm: "calm", loud: "loud" } },
  defaults: { tone: "calm" },
});

const size = cv({
  variants: { size: { sm: "sm", lg: "lg" } },
  defaults: { size: "sm" },
});

const composed = cv({
  composes: [tone, size],
  variants: { emphasis: { low: "low", high: "high" } },
  defaults: { tone: "loud", emphasis: "high" },
  compounds: [
    { tone: "loud", size: "lg", emphasis: "high", class: "hit" },
  ],
});

composed({ tone: "calm", size: "lg", emphasis: "low" });

// @ts-expect-error composed variant is still constrained
composed({ tone: "missing" });
// @ts-expect-error child variant is still constrained
composed({ size: "xl" });
// @ts-expect-error local variant is still constrained
composed({ emphasis: "medium" });

type Props = VariantProps<typeof composed>;
const props: Props = { tone: "loud", size: "sm", emphasis: "high" };
void props;

const single = cv({ composes: tone, defaults: { tone: "loud" } });
single({ tone: "calm" });
