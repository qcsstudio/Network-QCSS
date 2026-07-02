import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type");

    if (!type) {
      return NextResponse.json(
        { message: "Type parameter is required" },
        { status: 400 }
      );
    }
    const response = await fetch(`https://qcsstudio.vercel.app/api/admin/Policies?type=${type}`);
    const data = await response.json();

    return NextResponse.json(
      {
        message: "Policies retrieved successfully",
        data: data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Policy Fetch Error:", error);
    return NextResponse.json({ message: "Policy Fetch Error" }, { status: 500 });
  }
}
 