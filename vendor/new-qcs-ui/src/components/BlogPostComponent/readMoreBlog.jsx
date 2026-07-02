'use client'
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { FaChevronRight, FaChevronLeft } from "react-icons/fa";
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Head from 'next/head';

 


const SkeletonCard = () => (
  <div className="bg-[#F5F7F9] rounded-lg p-3 shadow animate-pulse">
    <div className="w-full h-48 bg-gray-300 rounded-md mb-4"></div>
    <div className="h-6 bg-gray-300 rounded mb-2 w-3/4"></div>
    <div className="h-4 bg-gray-300 rounded mb-2 w-1/2"></div>
    <div className="h-4 bg-gray-300 rounded mb-3 w-full"></div>
    <div className="h-10 bg-gray-300 rounded w-full"></div>
  </div>
);

const SkeletonRecentPost = () => (
  <div className="flex gap-3 items-start border-b border-gray-300 pb-3 rounded-md p-2 animate-pulse">
    <div className="w-16 h-16 bg-gray-300 rounded-md"></div>
    <div className="flex-1">
      <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
      <div className="h-3 bg-gray-300 rounded w-1/2"></div>
    </div>
  </div>
);

export default function ReadMoreBlog() {
  const { slug } = useParams();
  const decodedSlug = decodeURIComponent(slug);

  console.log("Original slug:", decodedSlug);
  const [blog, setBlog] = useState(null);
  const [blogs, setBlogs] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const blogsPerPage = 3;

  const fetchBlog = async () => {
    try {
      const OriginalHeading = decodedSlug.replace(/-/g, " ");
      const res = await fetch(`/api/blog/${OriginalHeading}`);
      if (!res.ok) throw new Error('Failed to fetch blog');
      const data = await res.json();
      setTimeout(() => {
        setBlog(data);
        setLoading(false);
      }, 2000);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchBlogs = async () => {
    try {
      const res = await fetch('/api/blog');
      if (!res.ok) throw new Error('Failed to fetch blogs');
      const data = await res.json();
      setTimeout(() => setBlogs(data), 3000);
    } catch (err) {
      console.error('Error fetching recent blogs:', err);
    }
  };

  useEffect(() => {
    if (slug) {
      fetchBlog();
      fetchBlogs();
    }
    const interval = setInterval(() => fetchBlogs(), 10000);
    return () => clearInterval(interval);
  }, [slug]);

  const indexOfLastBlog = currentPage * blogsPerPage;
  const indexOfFirstBlog = indexOfLastBlog - blogsPerPage;
  const currentBlogs = blogs.slice(indexOfFirstBlog, indexOfLastBlog);
  const totalPages = Math.ceil(blogs.length / blogsPerPage);

  const handlePrev = () => setCurrentPage((prev) => (prev > 1 ? prev - 1 : prev));
  const handleNext = () => setCurrentPage((prev) => (prev < totalPages ? prev + 1 : prev));

  const getPageNumbers = (totalPages, currentPage) => {
    const pages = [];
    if (totalPages <= 5) for (let i = 1; i <= totalPages; i++) pages.push(i);
    else if (currentPage <= 3) pages.push(1, 2, 3, '...', totalPages);
    else if (currentPage >= totalPages - 2) pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
    else pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
    return pages;
  };
  const cleanDescription = (html, wordLimit = 54) => {
    if (!html) return "";

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    // Normal text nikalna
    const text = tempDiv.textContent || tempDiv.innerText || "";
    const words = text.trim().split(/\s+/);

    if (words.length > wordLimit) {
      const truncatedText = words.slice(0, wordLimit).join(" ") + " ...";
      return `<p>${truncatedText}</p>`; // HTML safe truncate
    }

    return tempDiv.innerHTML;
  };

  return (
    <>
      <Head>
        <title>{blog?.title}</title>
        <meta name="description" content={"retetet"} />
        <meta property="og:title" content={blog?.title} />
        <meta property="og:description" content={"njhjhjjhh"} />
      </Head>
    
      <Navbar />

      <div className="w-[90%] mx-auto p-6 flex flex-col lg:flex-row gap-6">
        {/* blog */}
        <div className="w-full lg:w-[60%]">
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-[300px] bg-gray-300 rounded-lg" />
              <div className="h-10 bg-gray-300 w-3/4 rounded" />
              <div className="h-4 bg-gray-300 w-1/2 rounded" />
              <div className="h-4 bg-gray-300 w-full rounded" />
              <div className="h-4 bg-gray-300 w-full rounded" />
            </div>
          ) : error ? (
            <p className="text-center text-red-500">Error: {error}</p>
          ) : (
            <>
              <img src={blog.thumbnail} alt={blog.heading} width="960" height="540" loading="eager" className='rounded-lg mb-6' />
              <h2 className="font-light mb-4 font-unbounded">{blog.heading}</h2>
              <p className="text-sm text-gray-500 mb-2">Created: {new Date(blog.createdAt).toLocaleString()}</p>
              <div className=" text-[#202124]" dangerouslySetInnerHTML={{ __html: blog.description }}></div>
            </>
          )}
        </div>
        
        {/* Recent Post's------------------ */}
        <div className="w-full lg:w-[40%] h-[600px] mt-6 lg:mt-0 rounded-lg px-5 py-8 bg-[#F5F7F9] overflow-y-auto no-scrollbar">
          <h2 className={`text-[26px] font-bold mb-4 font-unbounded`}>Recent Post&#39;s</h2>
          <div className="space-y-4">
            {loading
              ? Array(5).fill(null).map((_, i) => <SkeletonRecentPost key={i} />)
              : blogs
                .slice()
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5)
                .map((recentBlog, index) => (
                  <Link
                    key={index}
                    href={`/blogs/${(recentBlog.slug?.trim().replace(/\s+/g, "-"))}`}
                    className="flex gap-3 items-start border-b border-gray-300 pb-3 hover:bg-gray-100 transition rounded-md p-2"
                  >
                    <Image
                      src={recentBlog.thumbnail}
                      width={64}
                      height={64}
                      alt={recentBlog.heading}
                      className="w-16 h-16 object-cover rounded-md"
                    />
                    <div>
                      <p className={`text-[15px] font-normal font-montserrat `}>
                        {recentBlog.heading.length > 50 ? recentBlog.heading.slice(0, 47) + '...' : recentBlog.heading}
                      </p>
                      <p className={`text-xs text-gray-500 font-montserrat`}>
                        {new Date(recentBlog.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </Link>
                ))}
          </div>
        </div>
      </div>


      <div className="w-[90%] mx-auto mt-10">
        <h3 className={`text-center text-4xl my-5 font-medium font-unbounded`}>More Blogs</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
          {loading
            ? Array(3).fill(null).map((_, i) => <SkeletonCard key={i} />)
            : currentBlogs.length === 0
              ? <p className="text-center text-gray-600 col-span-full">No blogs found.</p>
              : currentBlogs.map((blog, i) => (
                <div key={i} className="bg-[#F5F7F9] rounded-lg p-3 shadow hover:shadow-lg transition-shadow duration-300">
                  <Image
                    src={blog.thumbnail}
                    width={364.06}
                    height={242}
                    alt={blog.heading}
                    className="w-full h-48 object-cover rounded-md mb-4"
                    loading="lazy"
                  />
                  <h4 className={`text-[20px] font-light mb-2 font-unbounded`}>
                    {blog.heading.length > 50 ? blog.heading.slice(0, 47) + '...' : blog.heading}
                  </h4>
                  <p className={`text-sm text-gray-500 mb-2 font-montserrat`}>
                    Created: {new Date(blog.createdAt).toLocaleDateString()}
                  </p>
                  <div
                    className=" text-[15px] text-gray-700 mb-3 font-montserrat Blog-description"
                    dangerouslySetInnerHTML={{ __html: cleanDescription(blog.description, 54) }}
                  />
                  <Link
                    href={`/blogs/${blog.slug?.trim().replace(/\s+/g, "-")}`}
                    className="text-white bg-black w-full text-center px-6 py-2 rounded-md inline-block text-nowrap"
                  >
                    Read More
                  </Link>
                </div>
              ))}
        </div>

        <div className="flex justify-center gap-2 mb-10">
          <button onClick={handlePrev} disabled={currentPage === 1} className="px-3 py-1 rounded border disabled:opacity-50">
            <FaChevronLeft />
          </button>

          {getPageNumbers(totalPages, currentPage).map((page, index) =>
            page === '...'
              ? <span key={index} className="px-3 py-1 rounded border text-gray-500">...</span>
              : <button
                key={index}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1 rounded border ${page === currentPage ? 'bg-purple-600 text-white border-purple-600' : 'hover:bg-gray-100'}`}
              >
                {page}
              </button>
          )}

          <button onClick={handleNext} disabled={currentPage === totalPages} className="px-3 py-1 rounded border disabled:opacity-50">
            <FaChevronRight />
          </button>
        </div>
      </div>
    </>
  );
}
