import React from 'react'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
const UnderstandingtheResponse = dynamic(() => import("@/components/pdf_folder/UnderstandingtheResponse", { suspense: true }))
const page = () => {
    return (
        <>
            <Suspense>
               <UnderstandingtheResponse/>
            </Suspense>

        </>
    )
}
export default page