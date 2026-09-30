import type { MotionState } from "./scene-engine";
export function createSectionBackgrounds(
  state: () => MotionState,
  root: HTMLElement,
): {
  render(delta: number): void;
  setService(kind: string): void;
  dispose(): void;
};
