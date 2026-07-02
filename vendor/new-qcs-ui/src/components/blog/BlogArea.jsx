'use client'
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const BlogArea = () => {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visibleCount, setVisibleCount] = useState(9);

  console.log(blogs)

  const fetchBlogs = async () => {
    try {
      const res = await fetch('/api/blog');
      if (!res.ok) throw new Error('Failed to fetch blogs');
      const data = await res.json();

      setTimeout(() => {
        setBlogs(data);
        setLoading(false);
      }, 2000);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlogs();
    const interval = setInterval(fetchBlogs, 10000);
    return () => clearInterval(interval);
  }, []);

  const cleanDescription = (html, wordLimit = 54) => {
    if (!html) return "";

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    const text = tempDiv.textContent || tempDiv.innerText || "";
    const words = text.trim().split(/\s+/);

    if (words.length > wordLimit) {
      const truncatedText = words.slice(0, wordLimit).join(" ") + " ...";
      return `<p>${truncatedText}</p>`;
    }

    return tempDiv.innerHTML;
  };

const makeSlug = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/:/g, "")              // ❌ colon remove
    .replace(/[^\w\s-]/g, "")       // ❌ special chars remove
    .replace(/\s+/g, "-");          // spaces → hyphen
};


  const visibleBlogs = blogs.slice(0, visibleCount);

  return (
    <>
      <div className="cs_height_219 cs_height_lg_120"></div>

      <section>
        <div>
          <div className="container">
            <div className="cs_section_heading cs_style_1 cs_type_1">
              <div className="cs_section_heading_text">
                <h1 className="cs_section_title anim_heading_title">
                  New Day <br /> New Inspiration
                </h1>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="cs_height_100 cs_height_lg_60"></div>

      <section>
        <div className="container">
          <div className="row">

            {visibleBlogs.map((item, i) => {
              const isCenterCard = i % 3 === 1; //  row ka center card
console.log(item?.slug,"7777777777")
              return (
                <div
                  key={i}
                  className={`col-md-4 ${isCenterCard ? 'mt-0 mt-md-5' : ''}`}
                >
                  <div className="anim_div_ShowDowns">
                    {/* <Link href={`/blog-details/${item?.slug?.trim().replace(/\s+/g, "-")}`} className="cs_blog cs_style_1"> */}
                    <Link  href={`/blog-details/${makeSlug(item.slug)}`} className="cs_blog cs_style_1">
                      <div>
                        <Image
                          src={item?.thumbnail || ""} 
                          alt={item?.heading}
                          width={364}
                          height={400}
                          className='w-100 h-100'
                        />
                      </div>

                      <div className="cs_blog_info">
                        <h6 className="cs_blog_title">
                          {item?.heading}
                        </h6>

                        <p
                          className="cs_blog_subtitle"
                          dangerouslySetInnerHTML={{
                            __html: cleanDescription(item?.description, 17),
                          }}
                        />
                      </div>
                    </Link>
                  </div>
                </div>
              );
            })}

          </div>

          <div className="cs_height_100 cs_height_lg_60"></div>

          {/* LOAD MORE BUTTON */}
          {visibleCount < blogs.length && (
            <div className="cs_hero_btn_wrap text-center">
              <div className="cs_round_btn_wrap">
                <button
                  className="cs_hero_btn cs_round_btn btn-item"
                  onClick={() => setVisibleCount(prev => prev + 9)}
                >
                  <span></span> Load More
                </button>
              </div>
            </div>
          )}

        </div>
      </section>
    </>
  );
};

export default BlogArea;
