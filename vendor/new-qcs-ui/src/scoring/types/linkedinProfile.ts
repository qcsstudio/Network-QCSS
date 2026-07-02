export type Persona =
  | "job_seeker"
  | "founder_ceo"
  | "sales_sdr_ae"
  | "consultant_coach"
  | "recruiter_talent";

export interface LinkedInProfileSnapshot {
  url?: string;
  name?: string;
  headline?: string;
  location?: string;
  industry?: string;
  profilePictureUrl?: string;
  bannerUrl?: string;
  openToWork?: boolean;
  openToWorkVisibility?: "public" | "recruiters_only" | "unknown";
  openToWorkRoles?: string[];
  openToWorkLocations?: string[];
  noticePeriodOrAvailability?: string;
  expectedSalary?: string;
  verification?: {
    identityVerified?: boolean;
    workplaceVerified?: boolean;
    educationVerified?: boolean;
    recruiterVerified?: boolean;
  };
  about?: string;
  experience?: Array<{
    title?: string;
    company?: string;
    employmentType?: string;
    location?: string;
    startDateRaw?: string;
    endDateRaw?: string;
    isCurrent?: boolean;
    description?: string;
    mediaLinks?: string[];
  }>;
  education?: Array<{
    school?: string;
    degree?: string;
    field?: string;
    startDateRaw?: string;
    endDateRaw?: string;
    description?: string;
  }>;
  skills?: Array<{
    name: string;
    endorsementCount?: number;
    isTopSkill?: boolean;
    category?: "industry_knowledge" | "tools_technologies" | "interpersonal" | "unknown";
  }>;
  featured?: Array<{
    type?: "post" | "article" | "link" | "media" | "document" | "profile_content" | "other";
    title?: string;
    url?: string;
    description?: string;
  }>;
  recommendationsReceived?: Array<{
    recommenderName?: string;
    recommenderHeadline?: string;
    text?: string;
    dateRaw?: string;
  }>;
  activity?: Array<{
    type: "post" | "comment" | "reaction" | "article" | "newsletter" | "unknown";
    text?: string;
    createdAtRaw?: string;
    reactionsCount?: number;
    commentsCount?: number;
  }>;
  contact?: {
    email?: string;
    website?: string;
    customButtonUrl?: string;
    calendarUrl?: string;
    otherLinks?: string[];
  };
  rawText?: string;
}

export interface ProfileTargetContext {
  persona: Persona;
  targetRoleTitles?: string[];
  targetIndustries?: string[];
  targetLocations?: string[];
  icp?: string;
  offer?: string;
  targetBuyerTitles?: string[];
  categoryKeywords?: string[];
  recruitingNiche?: string;
  hiringMarkets?: string[];
  userSeniority?: "entry" | "mid" | "senior" | "executive" | "founder" | "unknown";
  inferred?: boolean;
  confidence?: "low" | "medium" | "high";
}

export interface ProfileSuggestion {
  id: string;
  persona: Persona;
  section:
    | "headline"
    | "about"
    | "experience"
    | "skills"
    | "featured"
    | "education"
    | "recommendations"
    | "activity"
    | "contact"
    | "verification"
    | "profile_completeness"
    | "positioning"
    | "offer"
    | "trust";
  category:
    | "SearchVisibility"
    | "Positioning"
    | "OfferClarity"
    | "Authority"
    | "RecruiterConversion"
    | "BuyerTrust"
    | "Credibility"
    | "Activity"
    | "BrandCoherence";
  priority: "HIGH" | "MEDIUM" | "LOW";
  impactScore: number;
  effortScore: number;
  reason: string;
  suggestionText: string;
  evidence?: string[];
  example?: string;
}

export interface ProfileMakeover {
  headlineOptions?: string[];
  aboutRewrite?: string;
  experienceBulletSuggestions?: Array<{
    roleTitle?: string;
    company?: string;
    suggestedBullets: string[];
  }>;
  skillsToAdd?: string[];
  skillsToMoveToTop?: string[];
  featuredPlan?: string[];
  activityPlan?: string[];
  verificationOrTrustPlan?: string[];
  warnings?: string[];
}

export interface ProfileScoreResult {
  persona: Persona;
  overallScore: number;
  scoreBand: "weak" | "average" | "strong" | "excellent";
  subScores: Record<string, {
    score: number;
    label: string;
    explanation: string;
    evidence?: string[];
  }>;
  searchVisibilityScore?: number;
  postClickConversionScore?: number;
  trustScore?: number;
  strengths: string[];
  risks: string[];
  suggestions: ProfileSuggestion[];
  makeover?: ProfileMakeover;
  debug?: {
    detectedKeywords?: string[];
    missingKeywords?: string[];
    keywordStuffingFlags?: Array<{ field: string; repeatedTerms?: string[]; reason?: string }>;
    missingSections?: string[];
    sectionScores?: Record<string, number>;
    metrics?: string[];
    standardsVersion?: string;
  };
}
