export const editorialImageWaitMessage = "LinkedIn delivery is waiting for the article-specific QCS image to finish generating.";

export function socialPublicationFailurePolicy(attempts: number, message: string) {
  const awaitingEditorialImage = message.includes("waiting for the article-specific QCS image");
  return {
    delayMinutes: awaitingEditorialImage ? 10 : Math.min(360, 2 ** attempts * 5),
    terminal: !awaitingEditorialImage && attempts >= 6
  };
}
