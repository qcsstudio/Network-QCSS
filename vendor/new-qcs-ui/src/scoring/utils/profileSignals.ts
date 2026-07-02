import type { LinkedInProfileSnapshot, ProfileTargetContext } from "../types/linkedinProfile";

export const hasAnyVerification = (profile: LinkedInProfileSnapshot) => Boolean(
  profile.verification?.identityVerified ||
  profile.verification?.workplaceVerified ||
  profile.verification?.educationVerified ||
  profile.verification?.recruiterVerified
);

export const detectICP = (text = "", context: ProfileTargetContext) => {
  const haystack = text.toLowerCase();
  const needles = [context.icp, ...(context.targetBuyerTitles || []), context.recruitingNiche].filter(Boolean) as string[];
  return needles.length ? needles.some((needle) => haystack.includes(needle.toLowerCase())) : /\b(founders|ceos|sales teams|recruiters|candidates|b2b|saas|agencies|startups|enterprises|leaders|buyers|clients)\b/i.test(text);
};

export const detectOffer = (text = "", context: ProfileTargetContext) => {
  if (context.offer && text.toLowerCase().includes(context.offer.toLowerCase())) return true;
  return /\b(help|build|deliver|provide|consult|coach|hire|recruit|sell|implement|optimize|scale|generate|book|audit|strategy|service|solution|platform)\b/i.test(text);
};

export const hasRecentActivity = (profile: LinkedInProfileSnapshot) => Boolean((profile.activity || []).length);

export const completenessScore = (profile: LinkedInProfileSnapshot) => {
  const checks = [
    profile.profilePictureUrl,
    profile.bannerUrl,
    profile.headline,
    profile.about,
    (profile.experience || []).length > 0,
    (profile.skills || []).length >= 10,
    profile.location,
    profile.contact?.website || profile.contact?.customButtonUrl || profile.contact?.calendarUrl,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
};
