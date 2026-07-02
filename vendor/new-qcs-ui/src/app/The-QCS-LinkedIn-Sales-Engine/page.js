import React from 'react'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
const LinkedInSalesEngine = dynamic(() => import("@/components/pdf_folder/LinkedInSalesEngine", { suspense: true }))
const page = () => {
    return (
        <>
            <Suspense>
               <LinkedInSalesEngine/>
            </Suspense>

        </>
    )
}

export default page