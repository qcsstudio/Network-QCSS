export type MotionState = {
  paused: boolean;
  reduced: boolean;
  labPaused: boolean;
  hidden: boolean;
};
export type SceneController = {
  render(delta: number): void;
  setMode(mode: string): void;
  reset(): void;
  replay(): void;
  resize(): void;
  dispose(): void;
};
export function createScene(
  element: HTMLElement,
  state: () => MotionState,
  onStage?: (index: number) => void,
): SceneController;
