// src/data/featureData.ts

export interface FeatureItem {
  id: number;
  title: string;
  des_1?: string;   // optional (service wala data me nahi hota)
  des_2: string;
}

export interface FeatureDataType {
  subtitle: string;
  title: string;
  des: string;
  boxtitle: string;
  box_des_1?: string;   // optional (service wala data me nahi hota)
  box_des_2: string;
  features: FeatureItem[];
  subtitle_2: string;
  title_2: string;
}

// ---------------- HOME PAGE DATA ----------------

export const featureData: FeatureDataType = {
  subtitle: `Features`,
  title: `Operational Intelligence That Scales With Governance and ROI`,
  des: ` QuantumCrafters unifies agentic AI, automation, and high-performance web/app delivery into one governed operating model. Agents execute across channels, workflows align to policy and KPIs, and data flows end-to-end for auditability. Leaders gain faster cycle times, reduced handoffs, and clear evidence of value creation—turning fragmented initiatives into a predictable growth engine.`,
  boxtitle: `Governed Autonomy`,
  box_des_1: `Governed Agent Execution`,
  box_des_2: `AI agents execute within rules and roles—accelerating work while preserving oversight, compliance, and audit trails.`,
  features: [
    {
      id: 1,
      title: `Unified Signal Layer`,
      des_1: `Canonical Data Core`,
      des_2: `CRM, product, and media data converge for one truth. Optimization propagates across channels without duplicate effort.`,
    },
    {
      id: 2,
      title: `Finance-Grade Metrics`,
      des_1: `Compounding ROI Evidence`,
      des_2: `Dashboards tie spend to revenue, expose friction, and guide weekly bets—driving measurable, compounding returns.`,
    },
  ],
  subtitle_2: `Why Choose Us`,
  title_2: `Maximizing Your Online Presence Digital Marketing Mastery`,
};

// ---------------- SERVICE PAGE DATA ----------------

export const featureDataservice: FeatureDataType = {
  subtitle: ` WHY QCS — The Elite Advantage`,
  title: `We operate on 3 principles:`,
  des: `You’re not hiring an agency.
 You’re partnering with a Growth Engineering Studio trusted by serious founders`,
  boxtitle: ` Precision Over Volume`,
  box_des_2: `Every outreach is intentional, relevant, and high-caliber.`,

  features: [
    {
      id: 1,
      title: `Engineering Over Guesswork`,
      des_2: `Repeatable systems beat random acts of marketing.`,
    },
    {
      id: 2,
      title: `Revenue Over Vanity`,
      des_2: `We focus on booked calls, closed deals, and pipeline expansion — nothing else.`,
    },
  ],

  subtitle_2: `Why Choose Us`,
  title_2: `Maximizing Your Online Presence Digital Marketing Mastery`,
};
