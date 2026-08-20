import { advisorySourceDefinitions, parseAdvisoryFeed, parseMsrcAdvisories } from "../src/lib/advisories";

function source(slug: string) {
  const definition = advisorySourceDefinitions.find((item) => item.slug === slug);
  if (!definition) throw new Error(`Missing source definition: ${slug}`);
  return definition;
}

async function main() {
  const aws = source("aws-security-bulletins");
  const google = source("google-cloud-security-bulletins");
  const microsoft = source("microsoft-msrc");
  const [awsResponse, googleResponse, updatesResponse] = await Promise.all([
    fetch(aws.url),
    fetch(google.url),
    fetch(microsoft.url, { headers: { accept: "application/json" } })
  ]);
  const awsBody = awsResponse.ok ? await awsResponse.text() : "";
  const googleBody = googleResponse.ok ? await googleResponse.text() : "";
  const report: Record<string, unknown> = {
    aws: { candidates: awsBody ? parseAdvisoryFeed(awsBody, aws).length : 0, finalHost: new URL(awsResponse.url).hostname, status: awsResponse.status },
    google: { candidates: googleBody ? parseAdvisoryFeed(googleBody, google).length : 0, finalHost: new URL(googleResponse.url).hostname, status: googleResponse.status }
  };
  let microsoftCandidates = 0;
  if (updatesResponse.ok) {
    const updatesPayload = (await updatesResponse.json()) as Array<Record<string, unknown>> | { value?: Array<Record<string, unknown>> };
    const updates = Array.isArray(updatesPayload) ? updatesPayload : updatesPayload.value || [];
    const now = new Date();
    const id = `${now.getUTCFullYear()}-${now.toLocaleString("en-US", { month: "short", timeZone: "UTC" })}`;
    const update = updates.find((item) => item.ID === id);
    if (update && typeof update.CvrfUrl === "string") {
      const documentResponse = await fetch(update.CvrfUrl, { headers: { accept: "application/json" } });
      if (documentResponse.ok) {
        const document = await documentResponse.json();
        microsoftCandidates = parseMsrcAdvisories(JSON.stringify({ documents: [{ id, initialReleaseDate: update.InitialReleaseDate, currentReleaseDate: update.CurrentReleaseDate, document }] }), microsoft).length;
      }
      report.microsoft = { candidates: microsoftCandidates, document: id, status: documentResponse.status };
    } else {
      report.microsoft = { candidates: 0, error: `MSRC has no ${id} CVRF document.`, status: updatesResponse.status };
    }
  } else {
    report.microsoft = { candidates: 0, error: "MSRC update index is temporarily unavailable.", status: updatesResponse.status };
  }
  console.log(JSON.stringify(report, null, 2));
  if (!awsBody || !googleBody || !microsoftCandidates) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
