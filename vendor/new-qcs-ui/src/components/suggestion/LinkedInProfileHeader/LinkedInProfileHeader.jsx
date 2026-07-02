"use client";
import Image from "next/image";
import ProfileSection from "../ProfileSection";

export default function LinkedInProfileHeader({ data }) {
  return (
   <>
   <ProfileSection data={data}/>
   </>
  );
}
