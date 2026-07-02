import ContactArea from '@/components/contact/ContactArea';
import Wrapper from '@/layouts/Wrapper';
import FooterOne from '@/layouts/footers/FooterOne';
import HeaderOne from '@/layouts/headers/HeaderOne';
import React from 'react';

export const metadata = {
  title: "Contact QuantumCrafters - AI Growth & Marketing Experts",
  description: "Get in touch with QuantumCrafters for AI-driven growth, marketing automation, LinkedIn optimization, and performance strategies that scale your business."
 
};


const index = () => {
  return (
    <Wrapper>
      <HeaderOne />
      <div id="smooth-wrapper">
        <div id="smooth-content">
          <main>
        <ContactArea />
        </main>
        <FooterOne />
      </div>
      </div>
    </Wrapper>
  );
};

export default index;
