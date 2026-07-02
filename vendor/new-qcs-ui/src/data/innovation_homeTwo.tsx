export interface DataType {
  title_1: string;
  des_1: string;
  title_2: string;
  des_2: string;
  features: {
    id: number;
    title: string;
    des: string;
  }[];
}

export const innovative_data_home: DataType = {
	title_1: `Unified Intelligence for Predictable Growth`,
	des_1: `Replace fragmented stacks with one operating model. QCS links AI agents, automation, and marketing so plans become execution—and execution learns—driving efficiency, visibility, and measurable compounding gains.`,
	title_2: ` Your Agentic Growth Architecture`,
	des_2: `A composable foundation of modular agents, reusable workflows, and AI-native UX. It personalizes journeys, enforces guardrails, and proves ROI with clear, auditable metrics your leadership can trust.`,
	features: [
		{
			id: 1,
			title: `Policy-Driven Flows`,
			des: ` Automations aligned to rules and KPIs.`,
		},
		{
			id: 2,
			title: `Unified Data Layer`,
			des: `Customer, content, and spend in one view.`,
		},
		{
			id: 3,
			title: `Auto-Tuning Engines`,
			des: `Systems that improve every release.`,
		},
	],
};
export const innovative_data_linkedin: DataType = {
	title_1: `Your Pipeline Is Underperforming.<br/>You Know It`,
	des_1: `LinkedIn, the platform with the highest B2B purchasing power on earth, is not delivering what it should.`,
	title_2: ` Unified Growth Engine`,
	des_2: `A unified operating model of agentic systems, reusable playbooks, and AI-first UX. It aligns messaging, automates follow-ups, and delivers predictable pipeline with transparent, board-ready metrics leaders trust.`,
	features: [
		{
			id: 1,
			title: ` Profile Not Converting`,
			des: `Looks impressive, but buyers still don’t take action.`,
		},
		{
			id: 2,
			title: `Content Misses Buyers`,
			des: `You post consistently, yet decision-makers remain cold, unmoved.`,
		},
		{
			id: 3,
			title: `Outreach Gets Silence`,
			des: ` Messages go out; replies don’t come, pipeline stalls.`,
		},
	],
};
