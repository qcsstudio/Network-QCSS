import React from 'react'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
const UnderstandingPositioningArchitecture = dynamic(() => import("@/components/pdf_folder/UnderstandingPositioningArchitecture", { suspense: true }))
const page = () => {
    return (
        <>
            <Suspense>
                <UnderstandingPositioningArchitecture />
            </Suspense>

        </>
    )
}

export default page