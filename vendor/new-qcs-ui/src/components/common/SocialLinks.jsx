import Link from "next/link";

// hero social links home three
const hero_link_home_three = [
  {
    id: 1,
    link: "https://www.facebook.com/qcsstudio",
    title: "Facebook",
  },
  {
    id: 2,
    link: "https://www.linkedin.com/company/qcsstudio",
    title: "Linkedin",
  },
  {
    id: 3,
    link: "https://www.instagram.com/qcsstudio",
    title: "Instagram",
  },
  {
    id: 4,
    link: "https://in.pinterest.com/qcsstudio/",
    title: "Pinterest",
  },
  {
    id: 5,
    link: "https://www.youtube.com/@qcsstudio",
    title: "Youtube",
  },
];

export const SocialLinks = () => {
  return (
    <>
      {hero_link_home_three.map((h_item, index) => (
        <Link
          key={index}
          href={h_item.link}
          className="cs_center"
          target="_blank"
        >
          {h_item.title}
        </Link>
      ))}
    </>
  );
};

// copy right text
const copy_right_text = {
  copy_right: (
    <>
     © 2026 QuantumCrafters Studio Pvt. Ltd. All rights reserved.

    </>
  ),
};

const { copy_right } = copy_right_text;

export const CopyRight = () => {
  return <>{copy_right}</>;
};
