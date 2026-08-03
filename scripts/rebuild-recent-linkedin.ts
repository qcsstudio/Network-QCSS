import { rebuildLinkedInPublicationsSince } from "../src/lib/social-publications";
import { getPrismaClient } from "../src/lib/prisma";

function option(name: string) {
  return process.argv.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}

async function main() {
  const since = new Date(option("--since") || "2026-07-30T18:30:00.000Z");
  const apply = process.argv.includes("--apply");
  const outcomes = await rebuildLinkedInPublicationsSince(since, apply);
  console.log(JSON.stringify({ apply, since: since.toISOString(), outcomes }, null, 2));
  await getPrismaClient().$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
