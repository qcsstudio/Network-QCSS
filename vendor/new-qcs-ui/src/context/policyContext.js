'use client';
import React, { createContext, useState } from 'react';

export const PolicyContext = createContext();

export const PolicyProvider = ({ children }) => {
  const [policyData, setPolicyData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPolicies = async (type) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/privacy-policy?type=${type}`);
      const data = await res.json();
      if (data && data.data) {
        setPolicyData(data.data.data);
      } else {
        setPolicyData([]);
      }
    } catch (err) {
      console.error('Error fetching policies:', err);
      setPolicyData([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PolicyContext.Provider value={{ policyData, loading, fetchPolicies }}>
      {children}
    </PolicyContext.Provider>
  );
};