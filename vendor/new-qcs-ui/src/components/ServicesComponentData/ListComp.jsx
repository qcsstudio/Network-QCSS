'use client';
import React, { useContext, useState } from 'react';
import { cardcontext } from '@/context/scrollcardcontext';
import { FaChevronRight } from 'react-icons/fa'; 
import { VscTriangleRight } from "react-icons/vsc";

const ListComp = ({ listData }) => {
  const { scrollToCard, activeIndex } = useContext(cardcontext); // assuming activeIndex is in context
  const [hoveredIndex, setHoveredIndex] = useState(null);

  return (
    <div className={`w-full lg:w-[37%] hidden lg:block font-unbounded`}>
      <div className="grid grid-cols-1 gap-3">
        {listData.map((service, index) => {
          const isActive = index === activeIndex;
          const isHovered = index === hoveredIndex;

          return (
            <div
              key={index}
              className="py-2 cursor-pointer flex items-center gap-2"
              onClick={() => scrollToCard(index)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Show different icon based on active or hover state */}
              <span className="text-[#0F0F0F] text-lg">
                {isActive ? (
                 <VscTriangleRight  className="text-[#F1813B] text-3xl" />
                ) : isHovered ? (
                  <FaChevronRight className="text-[#F1813B]" />
                ) : (
                  <span className="w-4 inline-block" /> // Placeholder to align
                )}
              </span>
              <h3 className="text-lg md:text-[20px] text-[#0F0F0F]">{service}</h3>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ListComp;
