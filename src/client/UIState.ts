import { PlayerBuildableUnitType } from "@openfront/engine-api/game/GameTypes";

export interface UIState {
  attackRatio: number;
  ghostStructure: PlayerBuildableUnitType | null;
  rocketDirectionUp: boolean;
  upgradeMultiplier: number;
  /** AlexFront: placing orbital laser points (right click cancels). */
  laserAiming?: boolean;
}
