'use client';
import { useEffect, useContext } from 'react';
import { PolicyContext } from '@/context/policyContext';
import Wrapper from "@/layouts/Wrapper";
import HeaderOne from "@/layouts/headers/HeaderOne";
import FooterOne from "@/layouts/footers/FooterOne";
import PolicyNav from './PolicyNav';


export default function PolicyPageTemplate({ type, title,activeKey }) {
  const { fetchPolicies, policyData, loading } = useContext(PolicyContext);

  useEffect(() => {
    fetchPolicies(type);
  }, [type]);

  return (
    <>
      <Wrapper>
        <HeaderOne />
        <div id="smooth-wrapper" className="">
          <div id="smooth-content">
            <main>
              <div className=" container mt-5 pt-5">
                <div className="bg-black  rounded">
                  <h2 className="text-4xl text-white font-bold text-center p-2">{title}</h2>
                </div>

                {loading ? (
                  <div className="spinner-border mx-auto my-5 d-block"
                    style={{width: "50px",height: "50px", borderWidth: "4px", color: "purple"}}
                    role="status" />

                ) : policyData.length > 0 ? (
                  policyData.map((item, index) => (
                    <div key={index} className="py-4">
                      <div dangerouslySetInnerHTML={{ __html: item.description }} />
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4">No policies available</div>
                )}


              <PolicyNav active={activeKey} />
              </div>
            </main>
            <FooterOne />
          </div>
        </div>
      </Wrapper>

    </>
  );
}
