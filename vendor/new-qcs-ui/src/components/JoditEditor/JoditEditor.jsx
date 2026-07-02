'use client'
import dynamic from 'next/dynamic';
import React, { useState, useRef, useMemo } from 'react';
const JoditEditor = dynamic(() => import("jodit-react"), { ssr: false });
export const Editor = ({ placeholder, setContent, content }) => {
    const editor = useRef(null);
    

    const config = useMemo(() => ({
        readonly: false,
        placeholder: placeholder || 'Start typings...'
    }),
        [placeholder]
    );

    return (
        <JoditEditor
            ref={editor}
            value={content.description}
            config={config}
            tabIndex={1} 
            onBlur={newContent => setContent(prev => ({ ...prev, description: newContent }))}
            onChange={() => { }} 
        />
    );
};