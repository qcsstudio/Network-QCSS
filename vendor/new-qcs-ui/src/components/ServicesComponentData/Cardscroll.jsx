// Cardscroll.js
'use client'
import Link from 'next/link';
import React from 'react';
import { motion } from 'framer-motion';
import { child, container } from '@/components/Animation/Animation';
import { Unbounded } from 'next/font/google';

const unbounded = Unbounded({ subsets: ['latin'], weight: '700' });

const Cardscroll = ({ card }) => {
  const { services, link, heading, desc } = card;

  return (
    <div className="p-6 rounded-2xl shadow-lg bg-[#F5F7F9]">
      <motion.h2
        className="text-lg md:text-[26px] text-[#0F0F0F] mb-2 flex flex-wrap"
        variants={container}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        {heading.split(' ').map((word, index) => (
          <motion.span
            key={index}
            variants={child}
            className={`inline-block mr-2 font-unbounded`}
          >
            {word}
          </motion.span>
        ))}
      </motion.h2>
      <p className={`text-[#0F0F0F] text-[15px] font-medium mb-4 font-montserrat`}>{desc}</p>
      <div className={`flex flex-wrap gap-2 mb-4 font-montserrat`}>
        {services?.map((service, index) => (
          <span
            key={index}
            className="px-3 py-1 bg-white text-[#0F0F0F] text-xs sm:text-sm font-medium rounded-full flex items-center gap-1 border"
          >
            {service}
          </span>
        ))}
      </div>

   {link && typeof link === 'string' && link.trim() !== '' ? (
  <Link href={link}>
    <button className={`w-full text-lg bg-white py-2 font-extrabold rounded-md font-montserrat hover:bg-gray-500 hover:text-white`}>
      Get Started
    </button>
  </Link>
) : (
  <button
    disabled
    className="w-full font-semibold text-lg bg-gray-300 py-2 rounded-md text-gray-500 cursor-not-allowed"
  >
    Coming Soon
  </button>
)}

    </div>
  );
};

export default Cardscroll;
