import { z } from "zod";

export const visualConceptSelectionSchema = z.object({
  candidates: z.array(z.object({
    name: z.string().min(4).max(70),
    scene: z.string().min(30).max(350),
    teachingValue: z.string().min(20).max(240),
    limitation: z.string().min(20).max(240)
  })).length(3),
  selectedIndex: z.number().int().min(0).max(2),
  selectionReason: z.string().min(30).max(400)
});

export const visualConceptInstructions = [
  "CONCEPT EXPLORATION: Read the full supplied content before designing. Propose exactly three genuinely different visual ideas in conceptSelection: different relationships or visual explanations, not three colour or camera variants of one composition.",
  "For each candidate record its scene, what the reader will understand, and a limitation or misconception it could introduce. Select the most accurate and useful idea, not the most dramatic. Explain the choice in selectionReason and implement that selected idea in the final scene.",
  "Consider a physical cutaway, a message journey, a before-and-after comparison, an exploded mechanism, a worked address example, or another idea derived from the actual topic. These are possibilities, not category presets. Do not decorate every topic with routers, shields or server racks.",
  "Keep one clear teaching point. An analogy must identify where it stops being technically accurate. Never show a conceptual flow as captured traffic or an illustration as a tested lab result.",
  "Keep exact addresses, commands, product versions, logos and technical labels out of generated raster art. They belong in validated code-rendered labels, accessible text, or the article itself. Use shape, position and text as well as colour to explain differences.",
  "Compare the selected concept with supplied recent work. Reusing a necessary domain object is acceptable; repeating its composition and narrative mechanism without a teaching reason is not. Record the distinction honestly."
].join(" ");

export function visualConceptIssues(selection: z.infer<typeof visualConceptSelectionSchema>) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return new Set(selection.candidates.map((candidate) => normalize(candidate.name))).size !== 3 ||
    new Set(selection.candidates.map((candidate) => normalize(candidate.scene))).size !== 3
    ? ["Propose three distinct visual concepts before selecting one."]
    : [];
}
