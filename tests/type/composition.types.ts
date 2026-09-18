import { cv, type VariantProps } from "../../src/index";

const tone = cv({
  variants: { tone: { calm: "calm", loud: "loud" } },
  defaultVariants: { tone: "calm" },
});

const size = cv({
  variants: { size: { sm: "sm", lg: "lg" } },
  defaultVariants: { size: "sm" },
});

const composed = cv({
  composes: [tone, size],
  variants: { emphasis: { low: "low", high: "high" } },
  defaultVariants: { tone: "loud", emphasis: "high" },
  compoundVariants: [
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

const single = cv({ composes: tone, defaultVariants: { tone: "loud" } });
single({ tone: "calm" });
