import { GAME_ID_REGEX } from "@openfront/engine-api/Schemas";
import { maps } from "@openfront/engine-api/game/GameTypes";
import {
  DAILY_MODIFIERS,
  dailyChallenge,
  msUntilNextDaily,
  dailyResult,
  formatDailyTime,
  recordDailyAttempt,
  recordDailyWin,
} from "../../src/client/DailyChallenge";

describe("daily challenge", () => {
  beforeEach(() => localStorage.clear());

  it("is the same for everyone on the same day", () => {
    const a = dailyChallenge(new Date(2026, 9, 16, 8, 0));
    const b = dailyChallenge(new Date(2026, 9, 16, 23, 30));
    expect(a).toEqual(b);
    expect(a.day).toBe("2026-10-16");
  });

  it("changes from day to day", () => {
    const ids = new Set(
      Array.from(
        { length: 10 },
        (_, i) => dailyChallenge(new Date(2026, 9, 1 + i)).gameID,
      ),
    );
    expect(ids.size).toBe(10);
  });

  it("never repeats yesterday's map or twist", () => {
    for (let i = 0; i < 400; i++) {
      const a = dailyChallenge(new Date(2026, 0, 1 + i));
      const b = dailyChallenge(new Date(2026, 0, 2 + i));
      expect(b.map).not.toBe(a.map);
      expect(b.modifier).not.toBe(a.modifier);
    }
  });

  it("goes through many different maps and every twist", () => {
    // 44 days hold at least one whole round of the 22 maps.
    const days = Array.from({ length: 44 }, (_, i) =>
      dailyChallenge(new Date(2026, 10, 1 + i)),
    );
    expect(new Set(days.map((d) => d.map)).size).toBe(22);
    expect(new Set(days.map((d) => d.modifier)).size).toBe(
      DAILY_MODIFIERS.length,
    );
  });

  it("knows when the next daily starts", () => {
    const ms = msUntilNextDaily(new Date(2026, 10, 9, 23, 0, 0));
    expect(ms).toBeGreaterThan(59 * 60 * 1000);
    expect(ms).toBeLessThan(62 * 60 * 1000);
  });

  it("uses a valid game id and a real map", () => {
    const d = dailyChallenge(new Date(2026, 9, 16));
    expect(d.gameID).toMatch(GAME_ID_REGEX);
    expect(maps.some((m) => m.type === d.map)).toBe(true);
  });

  it("keeps attempts and the best win time for today's game only", () => {
    const today = dailyChallenge();
    recordDailyAttempt(today.day);
    recordDailyAttempt(today.day);
    expect(recordDailyWin("notDaily1", 100)).toBe(false);
    expect(recordDailyWin(today.gameID, 600)).toBe(true);
    expect(recordDailyWin(today.gameID, 900)).toBe(true);
    expect(dailyResult(today.day)).toEqual({ attempts: 2, bestSeconds: 600 });
  });

  it("formats times as m:ss", () => {
    expect(formatDailyTime(605)).toBe("10:05");
  });
});
