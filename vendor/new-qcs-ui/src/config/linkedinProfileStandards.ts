export const LINKEDIN_PROFILE_STANDARDS = {
  version: "2026-05",
  sourceNotes: [
    "LinkedIn does not publish an exact profile-ranking formula; scores are explainable best-practice signals, not guarantees.",
    "Creator Mode toggle removed; do not score it.",
    "Profile hashtags/topics removed from intro; do not score them.",
    "Skills section supports up to 100 skills.",
    "Open to Work improves recruiter search visibility when job preferences are specified.",
    "Profile completeness improves discoverability/search appearances.",
    "Verification is a trust signal.",
    "Feed/content ranking uses profile, network, activity, and post-context signals. Activity quality is a supporting signal, not a guaranteed ranking lever.",
    "LinkedIn activity can include posts, comments, articles, newsletters, and profile activity; inactivity can hide activity visibility after long dormancy.",
    "Featured/profile-content pinning can be gated by Premium Business, Sales Navigator, or Recruiter; do not heavily penalize when unavailable.",
  ],
  headline: {
    maxCharsObserved: 220,
    idealChars: { min: 80, max: 160 },
    visibleFrontLoadChars: 70,
  },
  about: {
    maxCharsObserved: 2600,
    idealWords: { min: 150, max: 350 },
    idealChars: { min: 900, max: 2200 },
  },
  skills: {
    linkedinMax: 100,
    idealRelevantCount: { min: 15, max: 35 },
    minimumHealthyCount: 10,
    topSkillsCount: 3,
  },
  activity: {
    recentWindowDays: 60,
    dormantAfterDays: 180,
  },
} as const;
