const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4.1-mini";
const LINKEDIN_LIMITS = {
  headline: 220,
  about: 2600,
  experienceRoleDescription: 2000,
  experienceBullet: 600,
};
const PROJECTED_REWRITE_SCORE = 100;

const REWRITE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headlineOptions: {
      type: "array",
      items: { type: "string", maxLength: LINKEDIN_LIMITS.headline },
    },
    aboutRewrite: { type: "string", maxLength: LINKEDIN_LIMITS.about },
    experienceBulletSuggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          roleTitle: { type: "string" },
          company: { type: "string" },
          suggestedBullets: {
            type: "array",
            items: { type: "string", maxLength: LINKEDIN_LIMITS.experienceBullet },
          },
        },
        required: ["roleTitle", "company", "suggestedBullets"],
      },
    },
    featuredPlan: {
      type: "array",
      items: { type: "string" },
    },
    priorityFixes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          priority: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
          recommendation: { type: "string" },
        },
        required: ["id", "title", "priority", "recommendation"],
      },
    },
    assumptions: {
      type: "array",
      items: { type: "string" },
    },
    projectedScore: { type: "number" },
  },
  required: ["headlineOptions", "aboutRewrite", "experienceBulletSuggestions", "featuredPlan", "priorityFixes", "assumptions", "projectedScore"],
};

export async function POST(request) {
  try {
    const body = await request.json();

    if (!body?.paymentVerified) {
      return Response.json(
        { success: false, message: "Payment verification is required before generating an AI-enhanced rewrite." },
        { status: 402 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { success: false, message: "OpenAI API key is not configured for AI-enhanced rewrites." },
        { status: 503 }
      );
    }

    const report = body?.report || {};
    const profile = body?.profile || {};
    const fallback = buildRuleBasedRewrite({ report, profile });
    const aiRewrite = await generateAiRewrite({ report, profile, fallback });

    return Response.json({
      success: true,
      source: "openai",
      rewrite: enforceRewriteLimits(mergeRewrite(aiRewrite)),
    });
  } catch (error) {
    return Response.json(
      { success: false, message: error.message || "Unable to generate AI-enhanced profile rewrite" },
      { status: 500 }
    );
  }
}

async function generateAiRewrite({ report, profile, fallback }) {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_REWRITE_MODEL || DEFAULT_MODEL,
      instructions: [
        "You are a senior LinkedIn profile strategist for QCS Studio. Your rewrite must be specific to the scraped profile, never generic.",
        "Rewrite only from provided facts. Do not invent exact numbers, employers, clients, certifications, degrees, awards, or outcomes.",
        "Use the current scraped About, headline, roles, companies, skills, activity themes, niche signals, and proof signals as source material. Preserve useful specific nouns and category language from the profile.",
        "Rewrite against the QCS scoring engine: satisfy weak section scores for headline, About, experience, skills, proof, activity, trust, CTA, and persona-specific conversion signals.",
        "Naturally weave relevant terms from keywordBank into headline, About, and bullets. Use 1-3 meaningful mentions across sections; never create a comma-separated keyword dump.",
        "The output should be a 100% QCS implementation plan: rewritten copy plus priority fixes/actions needed so a later audit can score 100 after the user implements them.",
        "If proof is missing, use bracketed placeholders such as [insert verified metric] and explain the assumption.",
        `Hard limits: every headline <= ${LINKEDIN_LIMITS.headline} characters, About <= ${LINKEDIN_LIMITS.about} characters, each experience bullet <= ${LINKEDIN_LIMITS.experienceBullet} characters, each role's combined bullets <= ${LINKEDIN_LIMITS.experienceRoleDescription} characters.`,
        `Set projectedScore to ${PROJECTED_REWRITE_SCORE} because the paid rewrite is the target 100% QCS profile plan.`,
        "Keep copy direct, premium, and conversion-focused. Return JSON that matches the schema exactly.",
      ].join("\n"),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                task: "Create a paid LinkedIn rewrite workspace output.",
                profile: summarizeProfile(profile),
                audit: summarizeReport(report),
                rewriteIntelligence: buildRewriteIntelligence({ profile, report }),
                deterministicFallback: fallback,
                requiredCharacterLimits: LINKEDIN_LIMITS,
                requiredProjectedScore: PROJECTED_REWRITE_SCORE,
              }),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "linkedin_profile_rewrite",
          strict: true,
          schema: REWRITE_SCHEMA,
        },
      },
      max_output_tokens: 4500,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "OpenAI rewrite generation failed.");
  }

  const text = extractOutputText(data);
  if (!text) throw new Error("OpenAI rewrite response was empty.");
  return JSON.parse(text);
}

function buildRuleBasedRewrite({ report, profile }) {
  const persona = report?.persona || "job_seeker";
  const currentRole = first(profile?.experience) || {};
  const currentTitle = clean(currentRole.title) || clean(profile?.headline) || labelForPersona(persona);
  const company = clean(currentRole.company);
  const keywords = firstNonEmptyArray(report?.debug?.detectedKeywords, profile?.skills?.map((skill) => skill?.name)).slice(0, 4);
  const proofPlaceholder = "[insert verified metric, client result, hiring result, project, or case study]";
  const targetAudience = audienceForPersona(persona);
  const outcome = outcomeForPersona(persona);

  return {
    headlineOptions: [
      compactText([currentTitle, keywords.slice(0, 2).join(" + "), `Helping ${targetAudience} achieve ${outcome}`]).join(" | "),
      compactText([labelForPersona(persona), `Helping ${targetAudience} solve [specific problem]`, proofPlaceholder]).join(" | "),
      compactText([currentTitle, company && `@ ${company}`, `${outcome} with ${keywords[0] || "clear positioning"}`]).join(" | "),
    ].filter(Boolean).slice(0, 3),
    aboutRewrite: buildRuleBasedAbout({ profile, persona, currentTitle, company, keywords, targetAudience, outcome, proofPlaceholder }),
    experienceBulletSuggestions: buildRuleBasedBullets(profile),
    featuredPlan: [
      `Add one Featured asset that proves ${outcome}: a case study, portfolio/project link, client story, hiring win, or short PDF.`,
      `Add a proof-first CTA: “Message me about [specific goal]” or link to a booking/website page if available.`,
    ],
    priorityFixes: buildPriorityFixes(report),
    assumptions: buildAssumptions({ profile, report }),
    projectedScore: PROJECTED_REWRITE_SCORE,
  };
}

function buildRuleBasedAbout({ profile, persona, currentTitle, company, keywords, targetAudience, outcome, proofPlaceholder }) {
  const name = clean(profile?.name) || "[Your name]";
  const keywordPhrase = keywords.length ? keywords.slice(0, 3).join(", ") : "[core skills/category keywords]";
  const roleLine = compactText([currentTitle, company && `at ${company}`]).join(" ");
  const opening = persona === "recruiter_talent"
    ? `I am ${name}, ${roleLine}. I help ${targetAudience} connect the right talent with the right opportunities using ${keywordPhrase}.`
    : `I am ${name}, ${roleLine}. I help ${targetAudience} achieve ${outcome} using ${keywordPhrase}.`;

  return [
    opening,
    `My work focuses on [core capability], [audience pain point], and measurable outcomes. Add proof here: ${proofPlaceholder}.`,
    `If you are working on [relevant goal], connect or message me with context so we can see whether there is a fit.`,
  ].join("\n\n");
}

function buildRuleBasedBullets(profile) {
  return (profile?.experience || []).slice(0, 2).map((role, index) => ({
    roleTitle: clean(role?.title) || `Role ${index + 1}`,
    company: clean(role?.company) || "[company]",
    suggestedBullets: [
      `Owned [responsibility/project] for ${clean(role?.company) || "[company]"}, improving [verified business metric] by [insert result].`,
      `Partnered with [stakeholder/team] to deliver [initiative], resulting in [measurable outcome].`,
      `Used [tools/skills] to solve [problem] for [audience], creating [proof/result].`,
    ],
  }));
}

function buildPriorityFixes(report) {
  const mapped = (report?.suggestions || []).slice(0, 6).map((item, index) => ({
    id: item?.id || `fix-${index + 1}`,
    title: item?.reason || item?.finding || item?.title || "Improve a high-impact profile section.",
    priority: ["HIGH", "MEDIUM", "LOW"].includes(item?.priority) ? item.priority : impactLabel(item?.impactScore),
    recommendation: item?.suggestionText || item?.recommendation || "Rewrite this section with clearer audience, proof, keywords, and a direct next step.",
  }));

  if (mapped.length) return mapped;

  return [
    { id: "headline", title: "Make the headline specific to the audience and outcome.", priority: "HIGH", recommendation: "Use role/category + target audience + outcome + proof signal instead of a generic job title." },
    { id: "about", title: "Rewrite About with positioning, proof, and CTA.", priority: "HIGH", recommendation: "Open with who you help, name the problem, add verified proof, and end with one clear action." },
    { id: "proof", title: "Add visible proof assets.", priority: "HIGH", recommendation: "Add case studies, recommendations, project links, metrics, Featured media, or portfolio examples without inventing results." },
  ];
}

function mergeRewrite(aiRewrite) {
  const rewrite = {
    headlineOptions: validArray(aiRewrite?.headlineOptions, []).slice(0, 3),
    aboutRewrite: clean(aiRewrite?.aboutRewrite),
    experienceBulletSuggestions: validArray(aiRewrite?.experienceBulletSuggestions, []).slice(0, 3),
    featuredPlan: validArray(aiRewrite?.featuredPlan, []).slice(0, 4),
    priorityFixes: validArray(aiRewrite?.priorityFixes, []).slice(0, 6),
    assumptions: validArray(aiRewrite?.assumptions, []).slice(0, 5),
    projectedScore: PROJECTED_REWRITE_SCORE,
    characterLimits: LINKEDIN_LIMITS,
  };

  if (!rewrite.headlineOptions.length || !rewrite.aboutRewrite || !rewrite.priorityFixes.length) {
    throw new Error("OpenAI rewrite response did not include the required paid rewrite sections.");
  }

  return rewrite;
}

function enforceRewriteLimits(rewrite) {
  return {
    ...rewrite,
    headlineOptions: validArray(rewrite.headlineOptions, []).map((headline) => limitText(headline, LINKEDIN_LIMITS.headline)).slice(0, 3),
    aboutRewrite: limitText(rewrite.aboutRewrite, LINKEDIN_LIMITS.about),
    experienceBulletSuggestions: validArray(rewrite.experienceBulletSuggestions, []).map((role) => limitRoleBullets(role)),
    projectedScore: PROJECTED_REWRITE_SCORE,
    characterLimits: LINKEDIN_LIMITS,
  };
}

function limitRoleBullets(role) {
  const bullets = validArray(role?.suggestedBullets, [])
    .map((bullet) => limitText(bullet, LINKEDIN_LIMITS.experienceBullet))
    .filter(Boolean);
  const limitedBullets = [];
  let total = 0;

  for (const bullet of bullets) {
    const nextTotal = total + bullet.length + (limitedBullets.length ? 1 : 0);
    if (nextTotal <= LINKEDIN_LIMITS.experienceRoleDescription) {
      limitedBullets.push(bullet);
      total = nextTotal;
    }
  }

  return {
    roleTitle: limitText(role?.roleTitle || "Current role", 120),
    company: limitText(role?.company || "", 120),
    suggestedBullets: limitedBullets,
  };
}

function limitText(value, limit) {
  const text = clean(value);
  if (text.length <= limit) return text;
  const trimmed = text.slice(0, Math.max(0, limit - 1)).trimEnd();
  return `${trimmed}…`.slice(0, limit);
}

function summarizeProfile(profile) {
  return {
    name: clean(profile?.name),
    headline: clean(profile?.headline),
    about: truncate(clean(profile?.about), 1800),
    location: clean(profile?.location),
    industry: clean(profile?.industry),
    experience: (profile?.experience || []).slice(0, 3).map((role) => ({
      title: clean(role?.title),
      company: clean(role?.company),
      description: truncate(clean(role?.description), 900),
    })),
    skills: toArray(profile?.skills).slice(0, 35).map(skillName).filter(Boolean),
    featured: toArray(profile?.featured).slice(0, 5).map((item) => clean(item?.title || item?.description || item)).filter(Boolean),
    recommendations: toArray(profile?.recommendationsReceived || profile?.recommendations).slice(0, 5).map((item) => truncate(clean(item?.text || item?.description || item), 500)).filter(Boolean),
    activity: toArray(profile?.activity).slice(0, 5).map((item) => truncate(clean(item?.text || item?.content || item), 500)).filter(Boolean),
    contact: profile?.contact || {},
    rawTextSignals: truncate(clean(profile?.rawText), 1200),
  };
}

function summarizeReport(report) {
  return {
    persona: report?.persona,
    overallScore: report?.overallScore,
    scoreBand: report?.scoreBand,
    subScores: report?.subScores,
    strengths: report?.strengths,
    risks: report?.risks,
    suggestions: report?.suggestions?.slice(0, 8),
    detectedKeywords: report?.debug?.detectedKeywords,
    missingKeywords: report?.debug?.missingKeywords,
    sectionScores: report?.debug?.sectionScores,
    metrics: report?.debug?.metrics,
  };
}

function buildRewriteIntelligence({ profile, report }) {
  const fullText = [
    profile?.headline,
    profile?.about,
    ...(toArray(profile?.experience).map((role) => `${role?.title || ""} ${role?.company || ""} ${role?.description || ""} ${toArray(role?.skills).join(" ")}`)),
    ...(toArray(profile?.education).map((item) => `${item?.school || ""} ${item?.degree || ""} ${item?.field || ""} ${item?.description || ""}`)),
    ...toArray(profile?.skills).map(skillName),
    ...toArray(profile?.featured).map((item) => `${item?.title || ""} ${item?.description || ""}`),
    ...toArray(profile?.recommendationsReceived || profile?.recommendations).map((item) => item?.text || item?.description || item),
    ...toArray(profile?.activity).map((item) => item?.text || item?.content || item),
  ].map(clean).filter(Boolean).join("\n");
  const keywordBank = buildKeywordBank({ profile, report, fullText });
  const metrics = Array.from(new Set([...(toArray(report?.debug?.metrics)), ...((fullText.match(/(?:₹|\$)?\b\d+(?:[,.]\d+)*(?:%|x|k|m|cr|crore|lakh|\+)?\b/gi) || []))].map(clean).filter(Boolean))).slice(0, 12);
  const currentRole = first(toArray(profile?.experience)) || {};
  const sectionScores = report?.debug?.sectionScores || {};

  return {
    persona: report?.persona || profile?.role || "job_seeker",
    selectedRole: profile?.role,
    currentScore: report?.overallScore,
    targetScore: PROJECTED_REWRITE_SCORE,
    sectionScores,
    weakSections: Object.entries(sectionScores)
      .filter(([, score]) => Number(score) < 90)
      .map(([section, score]) => ({ section, score }))
      .slice(0, 12),
    nicheSignals: deriveNicheSignals({ profile, keywordBank, fullText }),
    aboutSection: {
      currentText: truncate(clean(profile?.about), LINKEDIN_LIMITS.about),
      wordCount: countWords(profile?.about),
      hasCurrentAbout: Boolean(clean(profile?.about)),
      instruction: "Use the current About as source material. Improve structure and scoring gaps, but keep useful specific facts and phrases.",
    },
    currentPosition: {
      title: clean(currentRole?.title),
      company: clean(currentRole?.company),
      location: clean(currentRole?.location),
      duration: clean(currentRole?.duration || currentRole?.startDateRaw || currentRole?.endDateRaw),
      currentDescription: truncate(clean(currentRole?.description), 900),
    },
    keywordBank,
    proofSignals: {
      metrics,
      featuredCount: toArray(profile?.featured).length,
      recommendationCount: toArray(profile?.recommendationsReceived || profile?.recommendations).length,
      proofInstruction: metrics.length ? "Use only these visible metrics if relevant." : "No verified metrics were scraped; keep proof as bracketed placeholders and request the user to fill them.",
    },
    scoringGaps: summarizeScoringGaps(report),
    scoringRulesToSatisfy: [
      "Headline: include persona/category, niche or ICP, outcome, and 1-2 high-value keywords within 220 characters.",
      "About: open with who the person helps, name niche/problem, explain offer/value, include scraped proof or placeholders, and end with CTA within 2600 characters.",
      "Experience: convert responsibilities into outcome-focused bullets using scraped roles/companies and bracketed metrics when proof is missing.",
      "Skills/keywords: use relevant keywords naturally across headline, About, experience bullets, Featured plan, and activity plan; avoid dumps and unnatural repetition.",
      "Proof/trust: add exact actions for missing proof, recommendations, verification, Featured alternatives, profile photo/banner, and contact path when scoring shows gaps.",
      "Activity: include persona-specific weekly activity ideas if the activity section is weak or missing.",
    ],
  };
}

function buildKeywordBank({ profile, report, fullText }) {
  const values = [
    ...toArray(report?.debug?.detectedKeywords),
    ...toArray(report?.debug?.missingKeywords),
    ...toArray(profile?.skills).map(skillName),
    ...splitHeadlineKeywords(profile?.headline),
    ...toArray(profile?.experience).flatMap((role) => [role?.title, role?.company, ...toArray(role?.skills)]),
    ...topRepeatedTerms(fullText).slice(0, 14),
  ];
  return Array.from(new Set(values.map(clean).filter((value) => value.length > 2 && value.length < 60)))
    .filter((value) => !/^\d+$/.test(value))
    .slice(0, 28);
}

function deriveNicheSignals({ profile, keywordBank, fullText }) {
  const headlineParts = splitHeadlineKeywords(profile?.headline);
  const about = clean(profile?.about);
  return {
    headlineCategories: headlineParts.slice(0, 8),
    likelyNiche: headlineParts.find((part) => /founder|sales|recruit|talent|coach|consult|developer|designer|marketing|automation|ai|saas|b2b|growth|linkedin/i.test(part)) || keywordBank[0] || "",
    repeatedAboutTerms: topRepeatedTerms(about).slice(0, 10),
    repeatedProfileTerms: topRepeatedTerms(fullText).slice(0, 12),
    activityThemes: toArray(profile?.activity).map((item) => clean(item?.text || item?.content)).filter(Boolean).slice(0, 3),
  };
}

function summarizeScoringGaps(report) {
  const subScores = report?.subScores || {};
  const weakSubScores = Object.entries(subScores)
    .filter(([, value]) => Number(value?.score) < 90)
    .map(([key, value]) => ({ key, label: value?.label, score: value?.score, explanation: value?.explanation }))
    .slice(0, 10);
  return {
    overallScore: report?.overallScore,
    scoreBand: report?.scoreBand,
    weakSubScores,
    topSuggestions: toArray(report?.suggestions).slice(0, 10).map((item) => ({
      id: item?.id,
      section: item?.section,
      priority: item?.priority,
      reason: item?.reason,
      recommendation: item?.suggestionText || item?.recommendation,
    })),
    risks: toArray(report?.risks).slice(0, 8),
  };
}

function splitHeadlineKeywords(value) {
  return clean(value).split(/\||•|,|–|—| - /).map(clean).filter(Boolean);
}

function topRepeatedTerms(text) {
  const stop = new Set(["with", "from", "that", "this", "your", "have", "will", "help", "using", "about", "into", "and", "the", "for", "you", "our", "are", "was", "were"]);
  const counts = new Map();
  clean(text).toLowerCase().match(/[a-z][a-z0-9+#.-]{3,}/g)?.forEach((word) => {
    if (!stop.has(word)) counts.set(word, (counts.get(word) || 0) + 1);
  });
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([word]) => word);
}

function countWords(value) {
  return clean(value).split(/\s+/).filter(Boolean).length;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function skillName(skill) {
  return clean(typeof skill === "string" ? skill : skill?.name || skill?.title || skill?.skill);
}

function extractOutputText(data) {
  if (typeof data?.output_text === "string") return data.output_text;
  return (data?.output || [])
    .flatMap((item) => item?.content || [])
    .map((content) => content?.text || "")
    .join("")
    .trim();
}

function buildAssumptions({ profile, report }) {
  const assumptions = [];
  if (!profile?.about) assumptions.push("Current About section was missing or unavailable, so the rewrite uses placeholders for audience, problem, and proof.");
  if (!profile?.experience?.length) assumptions.push("Experience history was missing or unavailable, so bullet rewrites use generic achievement placeholders.");
  if (!report?.debug?.detectedKeywords?.length) assumptions.push("Few target keywords were detected, so keyword suggestions are inferred from persona and visible role data.");
  if (!assumptions.length) assumptions.push("Rewrite uses only scraped profile facts and bracketed placeholders where proof must be verified by the user.");
  return assumptions;
}

function first(items) {
  return Array.isArray(items) ? items[0] : undefined;
}

function firstNonEmptyArray(...arrays) {
  for (const array of arrays) {
    const values = (array || []).map(clean).filter(Boolean);
    if (values.length) return values;
  }
  return [];
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function compactText(values) {
  return values.map(clean).filter(Boolean);
}

function truncate(value, maxLength) {
  if (!value) return "";
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function validArray(value, fallback) {
  return Array.isArray(value) && value.length ? value : fallback;
}

function impactLabel(score) {
  if (score >= 80) return "HIGH";
  if (score >= 55) return "MEDIUM";
  return "LOW";
}

function labelForPersona(persona) {
  const labels = {
    job_seeker: "Role-focused professional",
    founder_ceo: "Founder / CEO",
    sales_sdr_ae: "B2B sales partner",
    consultant_coach: "Consultant / Coach",
    recruiter_talent: "Recruiter / Talent partner",
  };
  return labels[persona] || labels.job_seeker;
}

function audienceForPersona(persona) {
  const audiences = {
    job_seeker: "hiring teams understand my fit faster",
    founder_ceo: "buyers and partners",
    sales_sdr_ae: "target accounts and buyers",
    consultant_coach: "clients in my niche",
    recruiter_talent: "candidates and hiring teams",
  };
  return audiences[persona] || audiences.job_seeker;
}

function outcomeForPersona(persona) {
  const outcomes = {
    job_seeker: "a clearer role match",
    founder_ceo: "stronger pipeline and market trust",
    sales_sdr_ae: "more relevant sales conversations",
    consultant_coach: "clearer decisions and better outcomes",
    recruiter_talent: "faster, higher-trust hiring decisions",
  };
  return outcomes[persona] || outcomes.job_seeker;
}
