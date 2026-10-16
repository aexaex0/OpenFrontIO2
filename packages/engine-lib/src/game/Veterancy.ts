// Shared warship-veterancy math. Lives in engine-lib (integer percent math, no
// floats) so the engine and the renderer derive identical effective max health.

/**
 * Effective max health for a warship at a given veterancy level.
 *
 * Each veterancy level adds `healthBonusPercent`% of base max health, floored to
 * an integer to keep the engine deterministic. Returns `baseMaxHealth` unchanged
 * at veterancy 0 (and therefore for any non-veteran or non-warship unit).
 */
export function maxHealthWithVeterancy(
  baseMaxHealth: number,
  veterancy: number,
  healthBonusPercent: number,
  tier: number = 1,
  tierHealthBonusPercent: number = 0,
): number {
  // A warship built at an upgraded port (tier > 1) starts sturdier: each tier
  // above 1 adds `tierHealthBonusPercent`% of base health, before veterancy.
  if (tier > 1) {
    baseMaxHealth += Math.floor(
      (baseMaxHealth * (tier - 1) * tierHealthBonusPercent) / 100,
    );
  }
  if (veterancy <= 0) {
    return baseMaxHealth;
  }
  return (
    baseMaxHealth +
    Math.floor((baseMaxHealth * veterancy * healthBonusPercent) / 100)
  );
}
