import type { LinkedInProfileSnapshot, Persona, ProfileTargetContext } from "./types/linkedinProfile";

const trim = (value: unknown) => typeof value === "string" ? value.trim() : undefined;
const compact = <T>(items?: T[]) => Array.isArray(items) ? items.filter(Boolean) : [];

const normalizeSkills = (rawSkills: unknown): LinkedInProfileSnapshot["skills"] => {
  const skills = Array.isArray(rawSkills) ? rawSkills : typeof rawSkills === "string" ? rawSkills.split(/,|\n/) : [];
  const seen = new Set<string>();
  return skills.map((skill: any) => {
    const name = trim(typeof skill === "string" ? skill : skill?.name || skill?.title || skill?.skill);
    if (!name) return null;
    const key = name.toLowerCase();
    if (seen.has(key)) return null;
    seen.add(key);
    return {
      name,
      endorsementCount: Number(skill?.endorsementCount || skill?.endorsements || 0) || undefined,
      isTopSkill: Boolean(skill?.isTopSkill),
      category: skill?.category || "unknown",
    };
  }).filter(Boolean) as LinkedInProfileSnapshot["skills"];
};

const normalizeExperience = (items: unknown): LinkedInProfileSnapshot["experience"] => compact(Array.isArray(items) ? items : []).map((item: any) => ({
  title: trim(item.title || item.role || item.position),
  company: trim(item.company || item.companyName),
  employmentType: trim(item.employmentType),
  location: trim(item.location),
  startDateRaw: trim(item.startDateRaw || item.startDate),
  endDateRaw: trim(item.endDateRaw || item.endDate),
  isCurrent: Boolean(item.isCurrent || /present/i.test(String(item.duration || item.endDateRaw || ""))),
  description: trim(item.description || item.summary),
  mediaLinks: compact(item.mediaLinks || item.media || []),
}));

export const normalizeLinkedInProfile = (raw: any = {}): LinkedInProfileSnapshot => {
  const source = raw?.profile || raw?.original?.profile || raw;
  return {
    url: trim(source.url || raw.url || localStorageSafe("linkedin_audit_url")),
    name: trim(source.name || source.fullName),
    headline: trim(source.headline || source.title),
    location: trim(source.location),
    industry: trim(source.industry),
    profilePictureUrl: trim(source.profilePictureUrl || source.profile_picture || source.profileImage),
    bannerUrl: trim(source.bannerUrl || source.coverImage || source.backgroundImage),
    openToWork: Boolean(source.openToWork || source.open_to_work),
    openToWorkVisibility: source.openToWorkVisibility || "unknown",
    openToWorkRoles: compact(source.openToWorkRoles || source.open_to_work_roles || []),
    openToWorkLocations: compact(source.openToWorkLocations || []),
    noticePeriodOrAvailability: trim(source.noticePeriodOrAvailability || source.noticePeriod),
    expectedSalary: trim(source.expectedSalary),
    verification: {
      identityVerified: Boolean(source.verification?.identityVerified || source.identityVerified),
      workplaceVerified: Boolean(source.verification?.workplaceVerified || source.workplaceVerified),
      educationVerified: Boolean(source.verification?.educationVerified || source.educationVerified),
      recruiterVerified: Boolean(source.verification?.recruiterVerified || source.recruiterVerified),
    },
    about: trim(source.about || source.summary),
    experience: normalizeExperience(source.experience),
    education: compact(source.education || []).map((item: any) => ({
      school: trim(item.school || item.institute || item.name),
      degree: trim(item.degree),
      field: trim(item.field),
      startDateRaw: trim(item.startDateRaw || item.startDate),
      endDateRaw: trim(item.endDateRaw || item.endDate),
      description: trim(item.description),
    })),
    skills: normalizeSkills(source.skills),
    featured: compact(source.featured || []).map((item: any) => ({
      type: item.type || "other",
      title: trim(item.title),
      url: trim(item.url),
      description: trim(item.description),
    })),
    recommendationsReceived: compact(source.recommendationsReceived || source.recommendations || []).map((item: any) => ({
      recommenderName: trim(item.recommenderName || item.name),
      recommenderHeadline: trim(item.recommenderHeadline || item.headline),
      text: trim(item.text || item.description),
      dateRaw: trim(item.dateRaw || item.date),
    })),
    activity: compact(source.activity || source.posts || []).map((item: any) => ({
      type: item.type || "unknown",
      text: trim(item.text || item.content),
      createdAtRaw: trim(item.createdAtRaw || item.date),
      reactionsCount: Number(item.reactionsCount || item.reactions || 0) || undefined,
      commentsCount: Number(item.commentsCount || item.comments || 0) || undefined,
    })),
    contact: {
      email: trim(source.contact?.email || source.email),
      website: trim(source.contact?.website || source.website),
      customButtonUrl: trim(source.contact?.customButtonUrl || source.customButtonUrl),
      calendarUrl: trim(source.contact?.calendarUrl || source.calendarUrl),
      otherLinks: compact(source.contact?.otherLinks || source.links || []),
    },
    rawText: trim(source.rawText || raw.rawText || JSON.stringify(source)),
  };
};

const localStorageSafe = (key: string) => {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(key) || undefined;
};

export const personaFromRole = (role?: string): Persona => {
  const normalized = String(role || "").toLowerCase();
  if (normalized.includes("founder") || normalized.includes("ceo")) return "founder_ceo";
  if (normalized.includes("sales") || normalized.includes("sdr") || normalized.includes("ae")) return "sales_sdr_ae";
  if (normalized.includes("consultant") || normalized.includes("coach")) return "consultant_coach";
  if (normalized.includes("recruiter") || normalized.includes("talent")) return "recruiter_talent";
  return "job_seeker";
};

export const inferTargetContext = (profile: LinkedInProfileSnapshot, persona: Persona): ProfileTargetContext => {
  const current = profile.experience?.find((item) => item.isCurrent) || profile.experience?.[0];
  const topSkills = (profile.skills || []).slice(0, 8).map((skill) => skill.name);
  const headlineKeywords = (profile.headline || "").split(/[|,•-]/).map((part) => part.trim()).filter(Boolean).slice(0, 4);
  return {
    persona,
    targetRoleTitles: current?.title ? [current.title] : headlineKeywords,
    categoryKeywords: Array.from(new Set([...headlineKeywords, ...topSkills])).slice(0, 12),
    icp: persona === "founder_ceo" || persona === "sales_sdr_ae" || persona === "consultant_coach" ? undefined : undefined,
    recruitingNiche: persona === "recruiter_talent" ? current?.description || profile.industry : undefined,
    userSeniority: persona === "founder_ceo" ? "founder" : "unknown",
    inferred: true,
    confidence: "low",
  };
};
