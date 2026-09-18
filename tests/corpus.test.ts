import {
  describe,
  expect,
  test,
} from "bun:test"
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

import { cn } from "../src"
import {
  loadCorpus,
  loadCorpusManifest,
} from "./utility/corpus"

const manifest = loadCorpusManifest()

describe("real repository corpus", () => {
  for (const entry of manifest.entries) {
    test(`${entry.name} · ${entry.calls} calls`, () => {
      const calls = loadCorpus(
        entry,
        true,
      )

      for (
        let index = 0;
        index < calls.length;
        index++
      ) {
        const call = calls[index]!

        expect(
          cn(...call),
          `${entry.name} call ${index}`,
        ).toBe(
          twMerge(clsx(...call)),
        )
      }
    })
  }
})
