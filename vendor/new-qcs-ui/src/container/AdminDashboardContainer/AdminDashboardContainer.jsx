"use client";


import React, { useState } from 'react';

const AdminDashboardContainer = () => {
  const [content, setContent] = useState('');
  const [submittedContent, setSubmittedContent] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmittedContent(content);
  };

  return (
    <>
      
    </>
  );
}

export default AdminDashboardContainer;