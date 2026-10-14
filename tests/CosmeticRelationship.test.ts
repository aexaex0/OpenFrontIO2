import { UserMeResponse } from "@openfront/shared/ApiSchemas";
import { Crown } from "@openfront/shared/CosmeticSchemas";
import {
  cosmeticRelationship,
  crownRelationship,
} from "../src/client/Cosmetics";

// In this fork every cosmetic is free: everyone holds the wildcard flares.
function makeUserMe(flares: string[]): UserMeResponse {
  return {
    player: { flares },
  } as unknown as UserMeResponse;
}

describe("cosmeticRelationship (everything free)", () => {
  for (const type of ["flag", "pattern", "skin", "crown", "effect"]) {
    it(`treats every ${type} as owned, logged in or not`, () => {
      const opts = {
        wildcardFlare: `${type}:*`,
        requiredFlare: `${type}:cool`,
        priceSoft: 500,
        priceHard: undefined,
        affiliateCode: null,
        itemAffiliateCode: "someone_else",
      };
      expect(cosmeticRelationship(opts, makeUserMe([]))).toBe("owned");
      expect(cosmeticRelationship(opts, false)).toBe("owned");
    });
  }
});

describe("crownRelationship (everything free)", () => {
  const crown = { name: "gold", url: "/crowns/gold.png" } as Crown;

  it("treats a crown as owned without any flares", () => {
    expect(crownRelationship(crown, makeUserMe([]), null)).toBe("owned");
    expect(crownRelationship(crown, false, null)).toBe("owned");
  });
});
