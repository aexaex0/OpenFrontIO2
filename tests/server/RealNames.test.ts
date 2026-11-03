import { noteRealName, realNamesFor } from "../../src/server/RealNames";

describe("real names", () => {
  test("keeps a cleaned name per game and client", () => {
    noteRealName("g1", "c1", "  Kovács   Attila <b> ");
    noteRealName("g1", "c2", undefined);
    noteRealName("g1", "c3", "   ");
    expect(realNamesFor("g1")).toEqual({ c1: "Kovács Attila b" });
    expect(realNamesFor("other")).toEqual({});
  });
});
