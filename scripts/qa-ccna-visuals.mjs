import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { ccnaSocialVisual } from "../src/lib/ccna-social-visual.tsx";
import { firstNetworkVisualStory } from "../src/lib/ccna-visual-story.ts";

const directory = ".tmp-ccna-visual-qa";
await mkdir(directory, { recursive: true });
const lesson = {
  slug: "ccna-roadmap-and-lab-method", sequence: 1, week: 1,
  title: "Your first network: a step-by-step CCNA beginner lesson",
  moduleTitle: "Network foundations",
  content: {
    learnerOutcome: firstNetworkVisualStory.takeaway,
    sources: [...new Set(firstNetworkVisualStory.stages.flatMap((stage) => stage.sourceUrls))].map((url) => ({ url })),
    lab: { addressing: [{ address: "192.168.10.1/24" }, { address: "192.168.10.2/24" }] }
  }
};
for (const layout of ["artwork", "sequence", "comparison", "layers"]) {
  for (const [width, height] of [[1920, 1080], [1200, 630]]) {
    const record = structuredClone(lesson);
    if (layout !== "artwork") record.content.visualStory = { ...firstNetworkVisualStory, layout };
    const response = await ccnaSocialVisual(record, width, height);
    const buffer = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(buffer).metadata();
    const stats = await sharp(buffer).stats();
    assert.equal(metadata.width, width);
    assert.equal(metadata.height, height);
    assert.ok(stats.channels.some((channel) => channel.stdev > 15), "Rendered image must not be blank");
    const output = `${directory}/${layout}-${width}.png`;
    await writeFile(output, buffer);
    console.log(JSON.stringify({ output, width, height, bytes: buffer.length }));
  }
}
