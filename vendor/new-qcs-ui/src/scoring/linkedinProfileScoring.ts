import { LINKEDIN_PROFILE_STANDARDS } from "../config/linkedinProfileStandards";
import { generateProfileMakeover } from "../makeover/generateMakeover";
import type { LinkedInProfileSnapshot, Persona, ProfileScoreResult, ProfileSuggestion, ProfileTargetContext } from "./types/linkedinProfile";
import { normalizeLinkedInProfile, inferTargetContext, personaFromRole } from "./normalizeLinkedInProfile";
import { countChars, countWords, detectGenericBuzzwords, detectOutcomeLanguage, detectStandardTitle, extractNumbersAndMetrics, hasClearCTA, hasQuantifiedProof, scoreLengthRange, clamp } from "./utils/textAnalysis";
import { detectKeywordStuffing, distributedKeywordCoverage, keywordMatchScore } from "./utils/keywordAnalysis";
import { completenessScore, detectICP, detectOffer, hasAnyVerification, hasRecentActivity } from "./utils/profileSignals";

type Diagnostics = any;

const PERSONA_WEIGHTS: Record<Persona, Record<string, number>> = {
  job_seeker: {
    keywordRelevance: 0.35,
    completenessAndOpenToWork: 0.20,
    experienceAlignment: 0.15,
    skillsDepthAndFocus: 0.15,
    recruiterConversion: 0.10,
    activityAndRecency: 0.05,
  },
  founder_ceo: {
    positioningAndICP: 0.25,
    offerClarity: 0.20,
    authorityAndProof: 0.20,
    keywordAndCategoryFit: 0.15,
    trustAndVerification: 0.10,
    activityAndThoughtLeadership: 0.10,
  },
  sales_sdr_ae: {
    buyerTrustAndCredibility: 0.25,
    icpAndOfferAlignment: 0.20,
    headlineAndPositioning: 0.15,
    proofAndSocialValidation: 0.15,
    activityAndEngagement: 0.15,
    completenessAndContactability: 0.10,
  },
  consultant_coach: {
    nichePositioning: 0.25,
    offerAndOutcomeClarity: 0.20,
    authorityProof: 0.20,
    conversionAssets: 0.15,
    keywordCategoryFit: 0.10,
    activityAndTrust: 0.10,
  },
  recruiter_talent: {
    trustAndVerification: 0.25,
    recruitingNicheClarity: 0.20,
    talentAttraction: 0.20,
    clientCredibility: 0.15,
    activityAndMarketInsight: 0.10,
    completenessAndContactability: 0.10,
  },
};

const addSuggestion = (suggestions: ProfileSuggestion[], suggestion: ProfileSuggestion) => {
  if (!suggestions.some((item) => item.id === suggestion.id)) suggestions.push(suggestion);
};

export const scoreLinkedInProfilePayload = (payload: unknown, selectedRole?: string): ProfileScoreResult => {
  const profile = normalizeLinkedInProfile(payload);
  const persona = personaFromRole(selectedRole);
  const context = inferTargetContext(profile, persona);
  return scoreLinkedInProfile(profile, context);
};

export const scoreLinkedInProfile = (profile: LinkedInProfileSnapshot, context: ProfileTargetContext): ProfileScoreResult => {
  switch (context.persona) {
    case "founder_ceo": return scoreFounderCeoProfile(profile, context);
    case "sales_sdr_ae": return scoreSalesProfile(profile, context);
    case "consultant_coach": return scoreConsultantProfile(profile, context);
    case "recruiter_talent": return scoreRecruiterProfile(profile, context);
    case "job_seeker":
    default: return scoreJobSeekerProfile(profile, context);
  }
};

const buildBaseDiagnostics = (profile: LinkedInProfileSnapshot, context: ProfileTargetContext): Diagnostics => {
  const text = buildProfileText(profile);
  const keywords = context.categoryKeywords?.length ? context.categoryKeywords : inferDefaultKeywords(profile, context.persona);
  const stuffingFlags = [
    { field: "headline", ...detectKeywordStuffing(profile.headline || "") },
    { field: "about", ...detectKeywordStuffing(profile.about || "") },
    { field: "experience", ...detectKeywordStuffing((profile.experience || []).map((item) => item.description || "").join("\n")) },
  ].filter((item) => item.isStuffed);
  const missingSections = [
    !profile.headline && "headline",
    !profile.about && "about",
    !(profile.experience || []).length && "experience",
    !(profile.education || []).length && "education",
    !(profile.skills || []).length && "skills",
    !(profile.featured || []).length && "featured",
    !(profile.recommendationsReceived || []).length && "recommendations",
    !(profile.activity || []).length && "activity",
    !hasContactPath(profile) && "contact",
    !profile.profilePictureUrl && "profile photo",
    !profile.bannerUrl && "banner",
  ].filter(Boolean) as string[];

  const hasVerification = hasAnyVerification(profile);
  const hasProof = hasQuantifiedProof(text) || Boolean(profile.featured?.length || profile.recommendationsReceived?.length || profile.experience?.some((item) => item.mediaLinks?.length));
  const hasCTA = hasClearCTA(`${profile.about || ""} ${profile.contact?.website || ""} ${profile.contact?.customButtonUrl || ""} ${profile.contact?.calendarUrl || ""}`);
  const hasICP = detectICP(text, context);
  const hasOffer = detectOffer(text, context);
  const hasOutcome = detectOutcomeLanguage(text);

  const sectionScores = {
    headline: scoreHeadline(profile, context, keywords, { hasICP, hasOutcome }),
    about: scoreAbout(profile, context, keywords, { hasICP, hasOffer, hasOutcome, hasProof, hasCTA }),
    experience: scoreExperience(profile, keywords),
    education: scoreEducation(profile),
    skills: scoreSkills(profile, keywords, context.persona === "job_seeker"),
    featured: scoreFeatured(profile),
    recommendations: scoreRecommendations(profile),
    activity: scoreActivity(profile, keywords),
    contact: scoreContact(profile, hasCTA),
    trust: scoreTrust(profile, hasVerification),
    completeness: completenessScore(profile),
    visualBrand: scoreVisualBrand(profile),
    proof: scoreProof(profile, { hasProof, text }),
  };

  return {
    text,
    keywords,
    stuffingFlags,
    missingSections,
    sectionScores,
    keywordCoverage: distributedKeywordCoverage(profile, keywords),
    headlineLengthScore: scoreLengthRange(countChars(profile.headline), LINKEDIN_PROFILE_STANDARDS.headline.idealChars.min, LINKEDIN_PROFILE_STANDARDS.headline.idealChars.max, LINKEDIN_PROFILE_STANDARDS.headline.maxCharsObserved),
    aboutLengthScore: scoreLengthRange(countWords(profile.about), LINKEDIN_PROFILE_STANDARDS.about.idealWords.min, LINKEDIN_PROFILE_STANDARDS.about.idealWords.max),
    skillsCount: (profile.skills || []).length,
    hasVerification,
    hasProof,
    hasCTA,
    hasActivity: hasRecentActivity(profile),
    hasICP,
    hasOffer,
    hasOutcome,
    buzzwords: detectGenericBuzzwords(text),
    metrics: extractNumbersAndMetrics(text),
  };
};

const scoreJobSeekerProfile = (profile: LinkedInProfileSnapshot, context: ProfileTargetContext): ProfileScoreResult => {
  const d = buildBaseDiagnostics(profile, context);
  const standardTitleScore = Math.max(...(profile.experience || [{ title: profile.headline }]).map((item) => detectStandardTitle(item.title || "", context.targetRoleTitles || [])), 0);
  const openToWorkScore = profile.openToWork ? 100 : profile.openToWorkRoles?.length ? 85 : 45;
  const recruiterConversion = average([
    d.sectionScores.about,
    standardTitleScore,
    d.sectionScores.proof,
    d.sectionScores.contact,
    d.sectionScores.trust,
  ]);
  const subScores = {
    keywordRelevance: sub(average([d.keywordCoverage, d.sectionScores.headline, keywordMatchScore(d.text, d.keywords)]), "Keyword relevance", "Role and skill keyword coverage across headline, About, experience, education, activity, and skills.", evidenceFor(profile, ["headline", "about", "skills"])),
    completenessAndOpenToWork: sub(clamp(d.sectionScores.completeness * 0.45 + openToWorkScore * 0.35 + d.sectionScores.trust * 0.2), "Completeness & Open to Work", "Profile completeness, visuals, location/contact path, and job-preference visibility."),
    experienceAlignment: sub(average([standardTitleScore, d.sectionScores.experience, d.sectionScores.education]), "Experience alignment", "Current title, experience descriptions, education, metrics, and target role clarity."),
    skillsDepthAndFocus: sub(d.sectionScores.skills, "Skills depth & focus", "Relevant skills count, top-skill focus, keyword fit, and endorsements. LinkedIn supports up to 100 skills, but relevance matters more than volume."),
    recruiterConversion: sub(recruiterConversion, "Recruiter conversion", "About quality, proof, CTA, trust, and standard title clarity for recruiter reading."),
    activityAndRecency: sub(d.sectionScores.activity, "Activity & recency", "Recent role-relevant posts/comments and visible activity signals."),
  };
  return finishScore(profile, context, subScores, PERSONA_WEIGHTS.job_seeker, d);
};

const scoreFounderCeoProfile = (profile: LinkedInProfileSnapshot, context: ProfileTargetContext): ProfileScoreResult => {
  const d = buildBaseDiagnostics(profile, context);
  const subScores = {
    positioningAndICP: sub(clamp(d.sectionScores.headline * 0.35 + d.sectionScores.about * 0.35 + (d.hasICP ? 20 : 5) + (d.hasOutcome ? 10 : 0)), "Positioning & ICP", "Headline and About should make niche, ICP, problem, and outcome obvious."),
    offerClarity: sub(clamp(d.sectionScores.about * 0.45 + (d.hasOffer ? 25 : 5) + d.sectionScores.contact * 0.2 + (d.hasOutcome ? 10 : 0)), "Offer clarity", "Profile should make the offer, category, CTA, and next step obvious."),
    authorityAndProof: sub(average([d.sectionScores.proof, d.sectionScores.featured, d.sectionScores.recommendations, d.sectionScores.experience]), "Authority & proof", "Proof from metrics, recommendations, case studies, Featured, Experience media, or founder outcomes."),
    keywordAndCategoryFit: sub(average([d.keywordCoverage, d.sectionScores.skills, d.sectionScores.headline]), "Keyword & category fit", "Natural category keywords across headline, About, experience, skills, and activity without stuffing."),
    trustAndVerification: sub(average([d.sectionScores.trust, d.sectionScores.visualBrand, d.sectionScores.contact]), "Trust & verification", "Verification, photo/banner, contact path, recommendations, and profile completeness."),
    activityAndThoughtLeadership: sub(d.sectionScores.activity, "Activity & thought leadership", "Recent content or engagement around market POV, proof, ICP problems, and founder lessons."),
  };
  return finishScore(profile, context, subScores, PERSONA_WEIGHTS.founder_ceo, d);
};

const scoreSalesProfile = (profile: LinkedInProfileSnapshot, context: ProfileTargetContext): ProfileScoreResult => {
  const d = buildBaseDiagnostics(profile, context);
  const subScores = {
    buyerTrustAndCredibility: sub(clamp(average([d.sectionScores.proof, d.sectionScores.trust, d.sectionScores.recommendations, d.sectionScores.visualBrand]) - (d.buzzwords.length ? 8 : 0)), "Buyer trust & credibility", "Outbound profile must feel credible, specific, verified, and non-spammy."),
    icpAndOfferAlignment: sub(clamp(d.sectionScores.about * 0.35 + d.sectionScores.headline * 0.25 + (d.hasICP ? 20 : 5) + (d.hasOffer ? 15 : 5) + (d.hasOutcome ? 10 : 0)), "ICP & offer alignment", "Buyer, problem, offer, category, and outcome clarity for outbound."),
    headlineAndPositioning: sub(d.sectionScores.headline, "Headline & positioning", "Headline should say who you help and why buyers should trust you, not only job title."),
    proofAndSocialValidation: sub(average([d.sectionScores.proof, d.sectionScores.featured, d.sectionScores.recommendations, d.sectionScores.experience]), "Proof & social validation", "Metrics, recommendations, case studies, Experience proof, or useful proof assets."),
    activityAndEngagement: sub(d.sectionScores.activity, "Activity & engagement", "Relevant comments/posts in the buyer niche without spammy activity."),
    completenessAndContactability: sub(average([d.sectionScores.completeness, d.sectionScores.contact, d.sectionScores.visualBrand]), "Completeness & contactability", "Complete profile plus clear CTA/contact path."),
  };
  return finishScore(profile, context, subScores, PERSONA_WEIGHTS.sales_sdr_ae, d);
};

const scoreConsultantProfile = (profile: LinkedInProfileSnapshot, context: ProfileTargetContext): ProfileScoreResult => {
  const d = buildBaseDiagnostics(profile, context);
  const subScores = {
    nichePositioning: sub(clamp(d.sectionScores.headline * 0.35 + d.sectionScores.about * 0.35 + (d.hasICP ? 20 : 5) + d.sectionScores.skills * 0.1), "Niche positioning", "Clear niche, target audience, expertise category, and audience promise."),
    offerAndOutcomeClarity: sub(clamp(d.sectionScores.about * 0.45 + (d.hasOffer ? 25 : 5) + (d.hasOutcome ? 20 : 5) + d.sectionScores.contact * 0.1), "Offer & outcome clarity", "Consultant profile should sell a clear expertise-to-outcome path and next step."),
    authorityProof: sub(average([d.sectionScores.proof, d.sectionScores.featured, d.sectionScores.recommendations, d.sectionScores.experience]), "Authority proof", "Testimonials, recommendations, case studies, frameworks, media, or quantified outcomes."),
    conversionAssets: sub(average([d.sectionScores.contact, d.sectionScores.featured, d.sectionScores.about]), "Conversion assets", "CTA, proof asset, website, calendar, custom button, or Featured alternative."),
    keywordCategoryFit: sub(average([d.keywordCoverage, d.sectionScores.skills, d.sectionScores.activity]), "Keyword category fit", "Natural category terms across key sections and activity."),
    activityAndTrust: sub(average([d.sectionScores.activity, d.sectionScores.trust, d.sectionScores.visualBrand]), "Activity & trust", "Expertise content plus verification, visuals, and other trust signals."),
  };
  return finishScore(profile, context, subScores, PERSONA_WEIGHTS.consultant_coach, d);
};

const scoreRecruiterProfile = (profile: LinkedInProfileSnapshot, context: ProfileTargetContext): ProfileScoreResult => {
  const d = buildBaseDiagnostics(profile, context);
  const subScores = {
    trustAndVerification: sub(average([d.sectionScores.trust, d.sectionScores.recommendations, d.sectionScores.visualBrand]), "Trust & verification", "Recruiters benefit strongly from verification and candidate/client trust proof."),
    recruitingNicheClarity: sub(clamp(d.sectionScores.headline * 0.35 + d.sectionScores.about * 0.25 + keywordMatchScore(d.text, d.keywords) * 0.2 + (d.hasICP || context.recruitingNiche ? 20 : 5)), "Recruiting niche clarity", "Roles, industry, region, seniority, and market should be obvious."),
    talentAttraction: sub(average([d.sectionScores.about, d.sectionScores.contact, d.sectionScores.activity, d.sectionScores.proof]), "Talent attraction", "Candidate-facing clarity, approachable CTA, proof, and useful hiring activity."),
    clientCredibility: sub(average([d.sectionScores.proof, d.sectionScores.recommendations, d.sectionScores.experience, d.sectionScores.featured]), "Client credibility", "Client/candidate outcomes, roles handled, recommendations, and proof."),
    activityAndMarketInsight: sub(d.sectionScores.activity, "Activity & market insight", "Hiring insights, market updates, candidate advice, and role commentary."),
    completenessAndContactability: sub(average([d.sectionScores.completeness, d.sectionScores.contact, d.sectionScores.visualBrand]), "Completeness & contactability", "Complete profile and contact route for candidates/clients."),
  };
  return finishScore(profile, context, subScores, PERSONA_WEIGHTS.recruiter_talent, d);
};

const finishScore = (
  profile: LinkedInProfileSnapshot,
  context: ProfileTargetContext,
  subScores: ProfileScoreResult["subScores"],
  weights: Record<string, number>,
  diagnostics: Diagnostics
): ProfileScoreResult => {
  const stuffingPenalty = diagnostics.stuffingFlags.length ? 8 : 0;
  const missingCriticalPenalty = ["headline", "about", "experience", "skills"].filter((section) => diagnostics.missingSections.includes(section)).length * 4;
  const overallScore = clamp(Object.entries(weights).reduce((total, [key, weight]) => total + ((subScores[key]?.score || 0) * weight), 0) - stuffingPenalty - missingCriticalPenalty);
  const suggestions = buildSuggestions(profile, context, diagnostics, subScores);
  const searchKey = subScores.keywordRelevance?.score || subScores.keywordAndCategoryFit?.score || subScores.keywordCategoryFit?.score || subScores.recruitingNicheClarity?.score || 0;
  const resultWithoutMakeover: Omit<ProfileScoreResult, "makeover"> = {
    persona: context.persona,
    overallScore,
    scoreBand: getScoreBand(overallScore),
    subScores,
    searchVisibilityScore: average([diagnostics.keywordCoverage, searchKey, diagnostics.sectionScores.skills, diagnostics.sectionScores.headline]),
    postClickConversionScore: average([diagnostics.sectionScores.about, diagnostics.sectionScores.contact, diagnostics.sectionScores.proof, diagnostics.hasOffer ? 90 : 40]),
    trustScore: average([diagnostics.sectionScores.trust, diagnostics.sectionScores.proof, diagnostics.sectionScores.recommendations, diagnostics.sectionScores.visualBrand]),
    strengths: buildStrengths(profile, diagnostics),
    risks: buildRisks(diagnostics, suggestions),
    suggestions,
    debug: {
      detectedKeywords: diagnostics.keywords,
      missingKeywords: diagnostics.keywords.filter((keyword: string) => keywordMatchScore(diagnostics.text, [keyword]) === 0),
      keywordStuffingFlags: diagnostics.stuffingFlags.map(({ field, reason, repeatedTerms }: any) => ({ field, reason, repeatedTerms })),
      missingSections: diagnostics.missingSections,
      sectionScores: diagnostics.sectionScores,
      metrics: diagnostics.metrics,
      standardsVersion: LINKEDIN_PROFILE_STANDARDS.version,
    },
  };
  return { ...resultWithoutMakeover, makeover: generateProfileMakeover(profile, context, resultWithoutMakeover) };
};

const buildSuggestions = (profile: LinkedInProfileSnapshot, context: ProfileTargetContext, d: Diagnostics, subScores: ProfileScoreResult["subScores"]) => {
  const suggestions: ProfileSuggestion[] = [];
  if (!profile.headline) addSuggestion(suggestions, suggestion(context.persona, "missing-headline", "headline", "SearchVisibility", "HIGH", 95, 25, "Headline is missing.", headlineSuggestion(context.persona)));
  if (profile.headline && d.sectionScores.headline < 85) addSuggestion(suggestions, suggestion(context.persona, "headline-keyword-fit", "headline", "SearchVisibility", "HIGH", 90, 35, "Headline is not specific enough for search and first-glance conversion.", `${headlineSuggestion(context.persona)} Include niche, audience, outcome, and 1-2 natural category keywords.`, [profile.headline]));
  if (!profile.about || d.sectionScores.about < 85) addSuggestion(suggestions, suggestion(context.persona, "about-conversion-depth", "about", "Positioning", "HIGH", 94, 45, "About section is not yet strong enough for 100% conversion readiness.", "Rewrite About with niche/ICP, offer, keywords, verified proof or placeholders, trust language, and a clear next step."));
  if (d.sectionScores.experience < 80) addSuggestion(suggestions, suggestion(context.persona, "experience-proof-depth", "experience", "Credibility", "HIGH", 90, 45, "Experience section lacks enough role detail, metrics, media, or keyword alignment.", "Add outcome-focused bullets to current/recent roles with scope, tools, niche, audience, and verified metrics/placeholders."));
  if (!d.hasProof && ["founder_ceo", "sales_sdr_ae", "consultant_coach", "recruiter_talent"].includes(context.persona)) addSuggestion(suggestions, suggestion(context.persona, "missing-proof", "trust", "Credibility", "HIGH", 88, 40, "Profile lacks visible proof signals.", "Add verified metrics, recommendations, case studies, customer/candidate outcomes, Experience media, Featured alternatives, or a proof link."));
  if ((profile.skills?.length || 0) < LINKEDIN_PROFILE_STANDARDS.skills.minimumHealthyCount) addSuggestion(suggestions, suggestion(context.persona, "missing-skills", "skills", "SearchVisibility", "HIGH", 85, 25, "Skills section has too few relevant skills.", "Add relevant skills and prioritize the top 3. LinkedIn supports up to 100 skills, but relevance, order, and endorsements matter more than volume."));
  if ((profile.skills?.length || 0) > 70) addSuggestion(suggestions, suggestion(context.persona, "skills-prune", "skills", "BrandCoherence", "MEDIUM", 65, 30, "Skills list may be too broad.", "Prune or reorder irrelevant skills so the top skills match your persona and target opportunity."));
  if (!profile.featured?.length) addSuggestion(suggestions, suggestion(context.persona, "featured-proof-plan", "featured", "Authority", "MEDIUM", 74, 35, "No Featured proof assets were detected.", "If Featured is unavailable, use Experience media, About CTA, website link, custom button, or a visible case-study/project link instead."));
  if (context.persona === "job_seeker" && !profile.openToWork) addSuggestion(suggestions, suggestion(context.persona, "open-to-work", "profile_completeness", "RecruiterConversion", "HIGH", 90, 15, "Open to Work is not visible in the scraped data.", "If actively job-seeking, enable Open to Work. Consider recruiters-only visibility if privacy matters; India users can add availability/notice period and expected salary if comfortable."));
  if (["founder_ceo", "sales_sdr_ae", "recruiter_talent"].includes(context.persona) && !d.hasVerification) addSuggestion(suggestions, suggestion(context.persona, "verification-trust", "verification", "BuyerTrust", "MEDIUM", 78, 20, "No visible verification was detected.", "Add identity, workplace, education, or recruiter verification where available to improve trust."));
  if (!d.hasActivity) addSuggestion(suggestions, suggestion(context.persona, "activity-dormant", "activity", "Activity", "MEDIUM", 72, 45, "No recent activity was detected in the scraped data.", "Add simple weekly persona-specific activity: useful comments, proof posts, market insights, or candidate/client advice."));
  if (!d.hasCTA) addSuggestion(suggestions, suggestion(context.persona, "missing-cta", "contact", "OfferClarity", "MEDIUM", 70, 25, "No clear CTA/contact path was detected.", "Add a clear next step in About or Contact: message, email, website, portfolio, booking link, or custom button where available."));
  if (!profile.education?.length && context.persona === "job_seeker") addSuggestion(suggestions, suggestion(context.persona, "education-context", "education", "RecruiterConversion", "LOW", 52, 25, "Education section was not detected.", "Add relevant education, certifications, or training when it supports target role credibility."));
  if (d.stuffingFlags.length) addSuggestion(suggestions, suggestion(context.persona, "keyword-stuffing", "positioning", "BrandCoherence", "HIGH", 86, 40, "Keyword stuffing detected.", "Rewrite keyword-heavy text into natural buyer/recruiter language. One to three meaningful mentions are useful; repeated dumps reduce clarity."));
  return suggestions.sort((a, b) => b.impactScore - a.impactScore).slice(0, 14);
};

const scoreHeadline = (profile: LinkedInProfileSnapshot, context: ProfileTargetContext, keywords: string[], signals: { hasICP: boolean; hasOutcome: boolean }) => {
  const headline = profile.headline || "";
  if (!headline) return 0;
  const standardTitle = detectStandardTitle(headline, context.targetRoleTitles || []);
  return clamp(
    scoreLengthRange(countChars(headline), LINKEDIN_PROFILE_STANDARDS.headline.idealChars.min, LINKEDIN_PROFILE_STANDARDS.headline.idealChars.max, LINKEDIN_PROFILE_STANDARDS.headline.maxCharsObserved) * 0.2 +
    keywordMatchScore(headline, keywords) * 0.25 +
    standardTitle * 0.2 +
    (signals.hasICP ? 15 : 5) +
    (signals.hasOutcome ? 15 : 5) +
    (/[|•–—]/.test(headline) ? 5 : 0)
  );
};

const scoreAbout = (profile: LinkedInProfileSnapshot, context: ProfileTargetContext, keywords: string[], signals: { hasICP: boolean; hasOffer: boolean; hasOutcome: boolean; hasProof: boolean; hasCTA: boolean }) => {
  const about = profile.about || "";
  if (!about) return 0;
  const stuffing = detectKeywordStuffing(about).isStuffed ? 10 : 0;
  return clamp(
    scoreLengthRange(countWords(about), LINKEDIN_PROFILE_STANDARDS.about.idealWords.min, LINKEDIN_PROFILE_STANDARDS.about.idealWords.max) * 0.25 +
    keywordMatchScore(about, keywords) * 0.15 +
    (signals.hasICP ? 15 : 3) +
    (signals.hasOffer ? 15 : 3) +
    (signals.hasOutcome ? 10 : 2) +
    (signals.hasProof ? 10 : 2) +
    (signals.hasCTA ? 10 : 0) -
    stuffing
  );
};

const scoreExperience = (profile: LinkedInProfileSnapshot, keywords: string[]) => {
  const experience = profile.experience || [];
  if (!experience.length) return 0;
  const currentRole = experience.some((item) => item.isCurrent) ? 100 : 70;
  const descriptionCoverage = clamp((experience.filter((item) => countWords(item.description) >= 25).length / Math.min(experience.length, 3)) * 100);
  const metricsCoverage = clamp((experience.filter((item) => hasQuantifiedProof(item.description || "")).length / Math.min(experience.length, 3)) * 100);
  const keywordFit = keywordMatchScore(experience.map((item) => `${item.title || ""} ${item.company || ""} ${item.description || ""} ${(item.mediaLinks || []).join(" ")}`).join("\n"), keywords);
  const mediaProof = experience.some((item) => item.mediaLinks?.length) ? 100 : 45;
  return average([currentRole, descriptionCoverage, metricsCoverage, keywordFit, mediaProof]);
};

const scoreSkills = (profile: LinkedInProfileSnapshot, keywords: string[], jobSeeker = false) => {
  const skills = profile.skills || [];
  if (!skills.length) return 0;
  const countScore = scoreLengthRange(skills.length, LINKEDIN_PROFILE_STANDARDS.skills.minimumHealthyCount, LINKEDIN_PROFILE_STANDARDS.skills.idealRelevantCount.max, LINKEDIN_PROFILE_STANDARDS.skills.linkedinMax);
  const relevance = keywordMatchScore(skills.map((skill) => skill.name).join(" "), keywords);
  const topSkillFocus = skills.slice(0, LINKEDIN_PROFILE_STANDARDS.skills.topSkillsCount).some((skill) => keywordMatchScore(skill.name, keywords) > 0) ? 100 : 55;
  const endorsements = skills.some((skill) => (skill.endorsementCount || 0) > 0) ? 100 : 55;
  return clamp(countScore * (jobSeeker ? 0.35 : 0.3) + relevance * (jobSeeker ? 0.35 : 0.4) + topSkillFocus * 0.15 + endorsements * 0.15);
};

const scoreProof = (profile: LinkedInProfileSnapshot, d: { hasProof: boolean; text: string }): number => clamp(
  (d.hasProof ? 35 : 10) +
  Math.min(profile.recommendationsReceived?.length || 0, 3) * 10 +
  (profile.featured?.length ? 15 : 5) +
  (profile.experience?.some((item) => hasQuantifiedProof(item.description || "")) ? 20 : 0) +
  (extractNumbersAndMetrics(d.text).length ? 10 : 0)
);

const scoreFeatured = (profile: LinkedInProfileSnapshot) => {
  const featured = profile.featured || [];
  if (!featured.length) return 55;
  const detailed = featured.filter((item) => item.title || item.description || item.url).length;
  return clamp(55 + Math.min(detailed, 3) * 15);
};

const scoreRecommendations = (profile: LinkedInProfileSnapshot) => {
  const recommendations = profile.recommendationsReceived || [];
  if (!recommendations.length) return 45;
  const detailed = recommendations.filter((item) => countWords(item.text) >= 20 || item.recommenderHeadline).length;
  return clamp(55 + Math.min(detailed, 3) * 15);
};

const scoreEducation = (profile: LinkedInProfileSnapshot) => {
  const education = profile.education || [];
  if (!education.length) return 55;
  const detailed = education.filter((item) => item.school && (item.degree || item.field || item.description)).length;
  return clamp(60 + Math.min(detailed, 2) * 20);
};

const scoreActivity = (profile: LinkedInProfileSnapshot, keywords: string[]) => {
  const activity = profile.activity || [];
  if (!activity.length) return 35;
  const keywordFit = keywordMatchScore(activity.map((item) => item.text || "").join("\n"), keywords);
  const engagement = activity.some((item) => (item.reactionsCount || 0) + (item.commentsCount || 0) > 0) ? 85 : 55;
  const typeMix = new Set(activity.map((item) => item.type)).size > 1 ? 90 : 70;
  return average([scoreLengthRange(activity.length, 2, 5), keywordFit, engagement, typeMix]);
};

const scoreContact = (profile: LinkedInProfileSnapshot, hasCTA: boolean) => clamp(
  (hasCTA ? 45 : 10) +
  (profile.contact?.website ? 20 : 0) +
  (profile.contact?.customButtonUrl ? 15 : 0) +
  (profile.contact?.calendarUrl ? 15 : 0) +
  (profile.contact?.email ? 5 : 0)
);

const scoreTrust = (profile: LinkedInProfileSnapshot, hasVerification: boolean) => clamp(
  (hasVerification ? 35 : 15) +
  (profile.profilePictureUrl ? 15 : 0) +
  (profile.bannerUrl ? 10 : 0) +
  (profile.experience?.length ? 15 : 0) +
  (profile.education?.length ? 10 : 0) +
  (profile.recommendationsReceived?.length ? 15 : 0)
);

const scoreVisualBrand = (profile: LinkedInProfileSnapshot) => clamp(
  (profile.profilePictureUrl ? 45 : 5) +
  (profile.bannerUrl ? 35 : 10) +
  (profile.headline ? 20 : 0)
);

const buildStrengths = (profile: LinkedInProfileSnapshot, d: Diagnostics) => [
  d.sectionScores.headline >= 85 && "Headline is search and conversion aligned.",
  d.sectionScores.about >= 85 && "About section has strong positioning signals.",
  d.sectionScores.skills >= 85 && "Skills foundation is relevant and discoverable.",
  d.hasProof && "Proof signal detected.",
  d.hasVerification && "Verification trust signal detected.",
  d.hasActivity && "Activity signal detected.",
  profile.featured?.length && "Featured/proof assets detected.",
].filter(Boolean) as string[];

const buildRisks = (d: Diagnostics, suggestions: ProfileSuggestion[]) => [
  ...d.missingSections.slice(0, 6).map((section: string) => `Missing ${section} section.`),
  d.stuffingFlags.length ? "Keyword stuffing may reduce clarity." : undefined,
  ...suggestions.filter((item) => item.priority === "HIGH").slice(0, 4).map((item) => item.reason),
].filter(Boolean) as string[];

const buildProfileText = (profile: LinkedInProfileSnapshot) => [
  profile.name,
  profile.headline,
  profile.location,
  profile.industry,
  profile.about,
  ...(profile.experience || []).map((item) => `${item.title || ""} ${item.company || ""} ${item.description || ""} ${(item.mediaLinks || []).join(" ")}`),
  ...(profile.education || []).map((item) => `${item.school || ""} ${item.degree || ""} ${item.field || ""} ${item.description || ""}`),
  ...(profile.skills || []).map((skill) => skill.name),
  ...(profile.featured || []).map((item) => `${item.title || ""} ${item.description || ""}`),
  ...(profile.recommendationsReceived || []).map((item) => `${item.recommenderHeadline || ""} ${item.text || ""}`),
  ...(profile.activity || []).map((item) => item.text || ""),
  profile.contact?.website,
  profile.contact?.customButtonUrl,
  profile.contact?.calendarUrl,
].filter(Boolean).join("\n");

const hasContactPath = (profile: LinkedInProfileSnapshot) => Boolean(profile.contact?.website || profile.contact?.customButtonUrl || profile.contact?.calendarUrl || profile.contact?.email || hasClearCTA(profile.about || ""));
const average = (values: number[]) => clamp(values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0) / Math.max(values.length, 1));
const sub = (score: number, label: string, explanation: string, evidence?: string[]) => ({ score: clamp(score), label, explanation, evidence });
const getScoreBand = (score: number): ProfileScoreResult["scoreBand"] => score >= 85 ? "excellent" : score >= 70 ? "strong" : score >= 50 ? "average" : "weak";
const inferDefaultKeywords = (profile: LinkedInProfileSnapshot, persona: Persona) => Array.from(new Set([
  ...(profile.headline || "").split(/[|,•\-–—]/).map((item) => item.trim()).filter(Boolean),
  ...(profile.skills || []).slice(0, 12).map((skill) => skill.name),
  ...(profile.experience || []).slice(0, 3).flatMap((item) => [item.title, item.company]).filter(Boolean) as string[],
  persona.replace(/_/g, " "),
])).slice(0, 14);

const evidenceFor = (profile: LinkedInProfileSnapshot, fields: Array<"headline" | "about" | "skills">) => fields.map((field) => {
  if (field === "skills") return (profile.skills || []).slice(0, 5).map((skill) => skill.name).join(", ");
  return profile[field];
}).filter(Boolean) as string[];

const headlineSuggestion = (persona: Persona) => ({
  job_seeker: "Use: [Target Role] | [Core Skills] | [Domain].",
  founder_ceo: "Use: Founder @ [Company] | We help [ICP] achieve [Outcome].",
  sales_sdr_ae: "Use: [Role] at [Company] | Helping [ICP] solve [Problem].",
  consultant_coach: "Use: [Niche Consultant] | Helping [ICP] achieve [Outcome].",
  recruiter_talent: "Use: [Niche Recruiter] | Hiring [Roles] for [Industry/Region].",
}[persona]);

const suggestion = (
  persona: Persona,
  id: string,
  section: ProfileSuggestion["section"],
  category: ProfileSuggestion["category"],
  priority: ProfileSuggestion["priority"],
  impactScore: number,
  effortScore: number,
  reason: string,
  suggestionText: string,
  evidence?: string[]
): ProfileSuggestion => ({ id, persona, section, category, priority, impactScore, effortScore, reason, suggestionText, evidence });
