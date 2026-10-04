import { guardClarityNavigation, initializeClarity } from "./lib/clarity-client";

initializeClarity();

export function onRouterTransitionStart(url: string) {
  guardClarityNavigation(url);
}
