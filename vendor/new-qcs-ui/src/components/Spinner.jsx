import React from 'react';

function Spinner() {
  return (
    <div
      className="spinner-border text-purple"
      role="status"
      style={{ width: '1.5rem', height: '1.5rem' }}
    >
      <span className="visually-hidden">Loading...</span>
    </div>
  );
}

export default Spinner;
