import { NextResponse } from "next/server";
import connectMongo from "@/lib/mongodb";
import pdfViewers from "@/models/pdfViewers";

export async function GET(req) {
  try {
    await connectMongo();

    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const email = searchParams.get("email");
    const path = searchParams.get("path");
console.log(path,"111111111111")
    const user = await pdfViewers.findOne({ email, verifyToken: token });
console.log(user,"useruseruser")
    if (!user) {
      return NextResponse.json({ success: false, message: "Invalid token or email" }, { status: 400 });
    }

    if (user.verifyTokenExpiry < new Date()) {
      return NextResponse.json({ success: false, message: "Token expired" }, { status: 400 });
    }

    user.isVerified = true;
    user.verifyToken = token;
    user.verifyTokenExpiry =user.verifyTokenExpiry;
    await user.save();
     const redirectUrl = `${process.env.NEXT_PUBLIC_Live_URL}/${path}?token=${token}`;
    return NextResponse.redirect(redirectUrl);
    // return NextResponse.json({ success: true, message: "Email verified successfully!" });
  } catch (err) {
    console.error("Verify error:", err);
    return NextResponse.json({ success: false, message: "Error verifying email" }, { status: 500 });
  }
}
