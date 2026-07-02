import React, { useContext } from 'react';
import Cardscroll from './Cardscroll';
import { cardcontext } from '@/context/scrollcardcontext';

export default function Scrollcomp() {
  const { carddata, cardRefs } = useContext(cardcontext);

  return (
    <div className="w-full lg:w-[63%] h-[390px] lg:h-[600px] overflow-y-auto no-scrollbar space-y-4">
      {carddata.map((card, index) => (
        <div key={index} ref={(el) => (cardRefs.current[index] = el)}>
          <Cardscroll card={card} />
        </div>
      ))}
    </div>
  );
}
