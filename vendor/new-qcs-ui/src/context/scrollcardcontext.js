'use client';
import { usePathname } from 'next/navigation';
// import {
//   CardData,
//   CourseLinkData,
//   ServiceCardData,
//   ServiceLinkData,
// } from '@/components/serviceComponents/ServicesComponent/CardData';
// import { courses, services } from '@/components/serviceComponents/ServicesComponent/ListCompData';
import { courses, services } from '@/components/ServicesComponentData/ListCompData'
import React, { createContext, useEffect, useRef, useState } from 'react';
import { CardData, ServiceCardData } from '@/components/ServicesComponentData/CardData';

const initialState = {
  carddata: null,
  links: [],
  listData: [],
  scrollToCard: () => { },
  setScrollCardData: () => { },
  activeIndex: null,
  setActiveIndex: () => { },
  showTable: false,
  setShowTable: () => { },
  prefillData: null,
  setPrefillData: () => { }
};

export const cardcontext = createContext(initialState);

const Scrollcardcontext = ({ children }) => {
  const [carddata, setCarddata] = useState(null);
  const [listData, setListData] = useState([]);
  const [links, setLinks] = useState([]);
  const [activeIndex, setActiveIndex] = useState(null);
  const cardRefs = useRef([]);
  const pathname = usePathname();   
  const [showTable, setShowTable] = useState(initialState.showTable);
  const [prefillData, setPrefillData] = useState(initialState.prefillData);


  const setScrollCardData = (pageName) => {
    if (pageName === 'services') {
      const updatedCardData = ServiceCardData.map((card, index) => ({
        ...card,
        link: ServiceLinkData[index] || '',
      }));
      setCarddata(updatedCardData);
      setLinks(ServiceLinkData);
      setListData(services);
    } else if (pageName === 'courses') {
      const updatedCardData = CardData.map((card, index) => ({
        ...card,
        link: CourseLinkData.links[index] || '',
      }));
      setCarddata(updatedCardData);
      setLinks(CourseLinkData.links);
      setListData(courses);
    }
  };

  useEffect(() => {
    if (!carddata) {
      if (pathname.includes('services')) {
        setScrollCardData('services');
      } else if (pathname.includes('courses')) {
        setScrollCardData('courses');
      }
    }
  }, [pathname]);

  function scrollToCard(index) {
    setActiveIndex(index); // ✅ Set active index on click
    const ref = cardRefs.current[index];
    if (ref && ref.scrollIntoView) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  return (
    <cardcontext.Provider
      value={{
        carddata,
        links,
        listData,
        cardRefs,
        scrollToCard,
        setScrollCardData,
        activeIndex,       
        setActiveIndex,    
        showTable,
        setShowTable,
        prefillData,
        setPrefillData
      }}
    >
      {children}
    </cardcontext.Provider>
  );
};

export default Scrollcardcontext;
