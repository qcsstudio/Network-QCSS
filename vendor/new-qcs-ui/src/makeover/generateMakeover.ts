import type { LinkedInProfileSnapshot, ProfileMakeover, ProfileScoreResult, ProfileTargetContext } from "../scoring/types/linkedinProfile";

const personaHeadlineTemplates = {
  job_seeker: [
    "[Target Role] | [Core skill 1] + [Core skill 2] | Building [domain outcome]",
    "[Role/Function] professional helping teams with [skill/category] and [business outcome]",
    "[Target title] with experience in [industry/tool] | Open to [target roles]",
  ],
  founder_ceo: [
    "Founder @ [Company] | Helping [ICP] achieve [specific outcome]",
    "CEO, [Company] | We help [buyer] solve [pain] without [common tradeoff]",
    "Building [category/company] for [ICP] who need [outcome]",
  ],
  sales_sdr_ae: [
    "[Sales role] @ [Company] | Helping [ICP] solve [business problem]",
    "B2B sales partner for [buyer type] | [category] + [outcome]",
    "Helping [industry] teams improve [metric/outcome] with [company/product]",
  ],
  consultant_coach: [
    "[Niche] Consultant | Helping [ICP] achieve [outcome]",
    "Coach for [audience] | [problem] → [desired result]",
    "I help [ICP] build [capability] so they can [business outcome]",
  ],
  recruiter_talent: [
    "[Niche] Recruiter | Hiring [roles] for [industry/region]",
    "Talent partner for [market] | Connecting [candidates] with [companies]",
    "Recruiting [roles/seniority] across [industry] | [region/market]",
  ],
};

export const generateProfileMakeover = (
  profile: LinkedInProfileSnapshot,
  context: ProfileTargetContext,
  scoreResult: Omit<ProfileScoreResult, "makeover">
): ProfileMakeover => {
  const currentRole = profile.experience?.[0];
  const warnings = [];
  if (!profile.about) warnings.push("About rewrite uses placeholders because the current About section is missing.");
  if (!profile.experience?.length) warnings.push("Experience bullets use placeholders because no role history was detected.");

  return {
    headlineOptions: personaHeadlineTemplates[context.persona],
    aboutRewrite: buildAboutRewrite(profile, context),
    experienceBulletSuggestions: (profile.experience || []).slice(0, 2).map((role) => ({
      roleTitle: role.title,
      company: role.company,
      suggestedBullets: [
        `Owned [responsibility] for ${role.company || "[company]"}, improving [business metric] by [insert % improvement].`,
        `Partnered with [team/stakeholder] to deliver [project/outcome] for [insert number of users/customers/projects].`,
        `Used [tools/skills] to solve [problem], resulting in [measurable result].`,
      ],
    })),
    skillsToAdd: scoreResult.debug?.missingKeywords?.slice(0, 8) || [],
    skillsToMoveToTop: (profile.skills || []).slice(0, 3).map((skill) => skill.name),
    featuredPlan: [
      "Add one proof asset where available: case study, portfolio link, role-specific project, customer story, or hiring success story.",
      "If Featured is unavailable, add proof through Experience media, About CTA, website link, or profile custom button where available.",
    ],
    activityPlan: activityPlanForPersona(context.persona),
    verificationOrTrustPlan: [
      "Add identity, workplace, education, or recruiter verification where available and appropriate.",
      "Add proof without inventing numbers: recommendations, client/customer quotes, projects, case studies, or measurable placeholders you can verify.",
    ],
    warnings,
  };
};

const buildAboutRewrite = (profile: LinkedInProfileSnapshot, context: ProfileTargetContext) => {
  const role = profile.experience?.[0]?.title || "[your role]";
  const company = profile.experience?.[0]?.company || "[company]";
  const keywords = context.categoryKeywords?.slice(0, 3).join(", ") || "[core keywords]";
  return `I am ${profile.name || "[name]"}, ${role}${company ? ` at ${company}` : ""}. I help [target audience] solve [specific problem] using ${keywords}.\n\nMy work focuses on [core capability], [proof area], and [business outcome]. Recent proof: [insert verified metric, customer result, project, or hiring outcome].\n\nIf you are working on [relevant goal], connect or message me with context so we can see whether there is a fit.`;
};

const activityPlanForPersona = (persona: ProfileTargetContext["persona"]) => {
  const plans = {
    job_seeker: ["Comment weekly on recruiter and target-company posts with useful context.", "Publish 1 short monthly post showing a project, learning, or role-relevant insight."],
    founder_ceo: ["Post 2-4 times monthly about ICP pain, proof, market POV, and lessons learned.", "Comment on buyer and partner posts with non-promotional expertise."],
    sales_sdr_ae: ["Comment on buyer problems and industry trends before outbound touchpoints.", "Share practical customer/problem insights without sounding like a pitch."],
    consultant_coach: ["Post frameworks, client lessons, and objection-handling content for your niche.", "Use one post per week to answer an ICP objection or decision question."],
    recruiter_talent: ["Post hiring-market notes, role snapshots, and candidate advice.", "Comment on candidate/client conversations in your recruiting niche."],
  };
  return plans[persona];
};
