import React from 'react'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
const TheRevenueArchitecture = dynamic(() => import("@/components/pdf_folder/TheRevenueArchitecture", { suspense: true }))
const page = () => {
    return (
        <>
            <Suspense>
               <TheRevenueArchitecture/>
            </Suspense>

        </>
    )
}

export default page