import React from 'react'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
const HighTicketLinkedIn = dynamic(() => import("@/components/pdf_folder/HighTicketLinkedIn", { suspense: true }))
const page = () => {
    return (
        <>
            <Suspense>
                <HighTicketLinkedIn />
            </Suspense>

        </>
    )
}

export default page