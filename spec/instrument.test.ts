import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { KEYMAP, lookupKey } from "../src/scripts/input/keymap";
import { SCALE_DEGREE_COUNT, degreeName, randomWalkStep } from "../src/scripts/audio/scale";

// This week's spec: 36 keys (a-z, 0-9), a fixed F natural minor scale, and
// live synthesis only (no pre-recorded audio). These are the lines of the
// spec that are mechanically checkable -- see spec/README.md.

const ALPHANUMERIC_KEYS = "1234567890qwertyuiopasdfghjklzxcvbnm".split("");

describe("keymap: the 36-key contract", () => {
  it("has exactly 36 entries", () => {
    expect(KEYMAP.length).toBe(36);
  });

  it("covers every key a-z and 0-9, with no duplicates or gaps", () => {
    const keys = KEYMAP.map((def) => def.key);
    expect(new Set(keys).size).toBe(36);
    expect([...keys].sort()).toEqual([...ALPHANUMERIC_KEYS].sort());
  });

  it("every key is reachable through lookupKey, case-insensitively", () => {
    for (const def of KEYMAP) {
      expect(lookupKey(def.key)).toEqual(def);
      expect(lookupKey(def.key.toUpperCase())).toEqual(def);
    }
  });

  it("assigns categories to rows exactly as the spec's table maps them", () => {
    const categoryOf = (key: string) => lookupKey(key)?.category;

    for (const key of "1234567890") expect(categoryOf(key)).toBe("fx");
    for (const key of "qwertyuiop") expect(categoryOf(key)).toBe("stab");
    for (const key of "asdfghjkl") expect(categoryOf(key)).toBe("atmosphere");
    for (const key of "zxcvb") expect(categoryOf(key)).toBe("melody");
    for (const key of "nm") expect(categoryOf(key)).toBe("riser");
  });

  it("matches the category counts the table implies (10/10/9/5/2)", () => {
    const counts = KEYMAP.reduce<Record<string, number>>((acc, def) => {
      acc[def.category] = (acc[def.category] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ fx: 10, stab: 10, atmosphere: 9, melody: 5, riser: 2 });
  });
});

describe("scale: F natural minor", () => {
  it("has exactly the 7 expected pitch classes", () => {
    const pitchClasses = new Set(
      Array.from({ length: SCALE_DEGREE_COUNT }, (_, i) => degreeName(i).replace(/\d+$/, "")),
    );
    expect(pitchClasses).toEqual(new Set(["F", "G", "Ab", "Bb", "C", "Db", "Eb"]));
  });

  it("randomWalkStep never leaves the table's bounds, from any starting point", () => {
    for (let start = 0; start < SCALE_DEGREE_COUNT; start++) {
      for (let i = 0; i < 200; i++) {
        const next = randomWalkStep(start);
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThan(SCALE_DEGREE_COUNT);
      }
    }
  });

  it("randomWalkStep clamps rather than wraps at the edges", () => {
    for (let i = 0; i < 200; i++) {
      expect(randomWalkStep(0)).toBeGreaterThanOrEqual(0);
      expect(randomWalkStep(SCALE_DEGREE_COUNT - 1)).toBeLessThan(SCALE_DEGREE_COUNT);
    }
  });
});

describe("sound is made live: no pre-recorded audio assets", () => {
  const AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac", ".webm"];

  function files(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? files(path) : [path];
    });
  }

  const sourceFiles = files(resolve("src"));

  it("ships no audio asset files under src/", () => {
    const audioAssets = sourceFiles.filter((path) =>
      AUDIO_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext)),
    );
    expect(audioAssets).toEqual([]);
  });

  it("never references an <audio> element or the Audio() constructor", () => {
    const textFiles = sourceFiles.filter((path) => /\.(ts|astro|css)$/.test(path));
    for (const path of textFiles) {
      const contents = readFileSync(path, "utf8");
      expect(contents, `${path} should not use <audio> or new Audio(`).not.toMatch(
        /<audio\b|new Audio\(/,
      );
    }
  });
});
