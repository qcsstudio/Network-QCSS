export interface NavigationItem {
	id: number;
	title: string;
	link: string;
	has_dropdown: boolean;
	sub_menu?: {
		id: number;
		title: string;
		link: string;
	}[];
}

export const navigationData: NavigationItem[] = [
	{
		id: 1,
		title: "Home",
		link: "/",
		has_dropdown: false,
	},
	{
		id: 2,
		title: "About",
		link: "/about",
		has_dropdown: false,
	},
	{
		id: 3,
		title: "Services",
		link: "/linkedIn-Profile-Makeover",
		has_dropdown: true,
		sub_menu: [
			{
				id: 1,
				title: "LinkedIn Sales Engine",
				link: "/linkedIn-Profile-Makeover",
			},
			{
				id: 2,
				title: "LinkedIn Profile Audit",
				link: "/linkedin-profile-audit",
			},
			{
				id: 3,
				title: "Network Support Services",
				link: "/network-support-services",
			},
		],
	},
	{
		id: 4,
		title: "Contact",
		link: "/contact",
		has_dropdown: false,
	},
	{
		id: 5,
		title: "Blogs",
		link: "/blog",
		has_dropdown: false,
	},
];
