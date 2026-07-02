import React from 'react'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
const WhyYourLinkedin = dynamic(() => import("@/components/pdf_folder/WhyYourLinkedin", { suspense: true }))
const page = () => {
    return (
        <>
            <Suspense>
                <WhyYourLinkedin />
            </Suspense>

        </>
    )
}

export default page