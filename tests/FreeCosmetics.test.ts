import {
  FREE_COSMETICS,
  withFreeFlares,
} from "@openfront/shared/FreeCosmetics";
import { decodePatternData } from "@openfront/shared/PatternDecoder";
import { base64url } from "jose";
import { describe, expect, it } from "vitest";
import { PrivilegeCheckerImpl } from "../src/server/Privilege";

describe("free cosmetics catalog", () => {
  it("has patterns, skins and every kind of effect", () => {
    expect(Object.keys(FREE_COSMETICS.patterns).length).toBeGreaterThan(0);
    expect(Object.keys(FREE_COSMETICS.skins ?? {}).length).toBeGreaterThan(0);
    for (const type of [
      "transportShipTrail",
      "nukeTrail",
      "nukeExplosion",
      "structures",
      "warship",
      "train",
      "railroad",
    ] as const) {
      expect(
        Object.keys(FREE_COSMETICS.effects?.[type] ?? {}).length,
        type,
      ).toBeGreaterThan(0);
    }
  });

  it("only contains valid, free patterns", () => {
    for (const p of Object.values(FREE_COSMETICS.patterns)) {
      expect(() =>
        decodePatternData(p.pattern, base64url.decode),
      ).not.toThrow();
      expect(p.priceSoft).toBeUndefined();
      expect(p.priceHard).toBeUndefined();
    }
  });

  it("lets a player with no flares join with any cosmetic", () => {
    const checker = new PrivilegeCheckerImpl(FREE_COSMETICS, base64url.decode);
    const pattern = Object.values(FREE_COSMETICS.patterns)[0];
    const skin = Object.values(FREE_COSMETICS.skins ?? {})[0];
    const trail = Object.values(FREE_COSMETICS.effects?.nukeTrail ?? {})[0];
    const result = checker.isAllowed(withFreeFlares(undefined), {
      patternName: pattern.name,
      patternColorPaletteName: "chrome",
      skinName: skin.name,
      effects: { nukeTrail: trail.name, atom: "chrome_shockwave_atom" },
    });
    expect(result.type).toBe("allowed");
  });
});
