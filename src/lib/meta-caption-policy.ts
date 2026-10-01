import { z } from "zod";
import type { MetaChannel } from "./meta-publishing.ts";

export const metaCaptionPolicyVersion = "evidence-social-v1";
export const metaDraftSchema = z.object({
  hook: z.string().min(30).max(180),
  explanation: z.string().min(100).max(650),
  actions: z.array(z.string().min(15).max(150)).min(2).max(3),
  qualification: z.string().min(20).max(260),
  hashtags: z.array(z.string().regex(/^#[A-Za-z][A-Za-z0-9]*$/)).min(3).max(5),
  evidence: z.array(z.object({ claim: z.string().min(15).max(400), quote: z.string().min(15).max(600) })).min(2).max(5)
});

export function composeMetaCaption(channel: MetaChannel, draft: z.infer<typeof metaDraftSchema>, sourceUrl: string, evidence: string) {
  const data = metaDraftSchema.parse(draft);
  const url = new URL(sourceUrl);
  if (url.origin !== "https://www.qcsstudio.com" || !/^\/(resources|security-advisories)\/[a-z0-9-]+$/.test(url.pathname)) throw new Error("Use the original published QCS article URL.");
  const normalize = (value: string) => value.replace(/\s+/g, " ").toLowerCase().trim();
  for (const item of data.evidence) if (!normalize(evidence).includes(normalize(item.quote))) throw new Error("Caption evidence must quote the reviewed article exactly.");
  const prose = [data.hook, data.explanation, ...data.actions, data.qualification];
  if (prose.some((value) => /\.\.\.|\u2026|https?:\/\/|#[A-Za-z]|\*\*/.test(value))) throw new Error("Use complete prose without clipped sentences, embedded links or fake formatting.");
  const tags = [...new Set(data.hashtags)];
  if (tags.length < 3) throw new Error("Use distinct, relevant hashtags.");
  const footer = channel === "instagram"
    ? `Full QCS guide: ${sourceUrl}\nVisit qcsstudio.com and search the article title. Caption links may not be clickable.`
    : `Read the QCS technical brief: ${sourceUrl}`;
  const caption = [data.hook, data.explanation, `What you can do\n${data.actions.map((item, index) => `${index + 1}. ${item}`).join("\n")}`, data.qualification, footer, tags.slice(0, channel === "facebook" ? 3 : 5).join(" ")].join("\n\n");
  if ([...caption].length > (channel === "instagram" ? 2200 : 2400)) throw new Error("Rewrite the caption more concisely. Never truncate its source link, qualifications or hashtags.");
  return caption;
}
