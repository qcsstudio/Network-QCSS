import React from 'react'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
const ProspectIntelligence = dynamic(() => import("@/components/pdf_folder/ProspectIntelligence.jsx", { suspense: true }))
const page = () => {
    return (
        <>
            <Suspense>
                <ProspectIntelligence />
            </Suspense>

        </>
    )
}

export default page