

import AboutHomeFour from '@/components/about/AboutHomeFour';
import BlogDetails from '@/components/details/BlogDetails';
import Wrapper from '@/layouts/Wrapper';
import FooterOne from '@/layouts/footers/FooterOne';
import HeaderOne from '@/layouts/headers/HeaderOne';
import React from 'react';



export default async function Page({params}) {
  const { slug } = params;
  console.log(slug,"slug======")

const url = `${process.env.NEXT_PUBLIC_Local_URL}/api/blog/${slug}`;

let blog = null;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) blog = await res.json();
  } catch (e) {
    console.error("Page Fetch Error:", e);
  }


  return (
    <Wrapper>
      <HeaderOne />
      <div id="smooth-wrapper">
        <div id="smooth-content">
          <main>
            <BlogDetails blog={blog}  />
            <AboutHomeFour />
          </main>
          <FooterOne />
        </div>
      </div>
    </Wrapper>
  );
};

