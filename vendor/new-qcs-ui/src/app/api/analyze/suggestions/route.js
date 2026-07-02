export async function POST(request) {
  try {
    const body = await request.json();

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/analyze/suggestions`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${body.token}`  // send token if required
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return Response.json(data);

  } catch (error) {
    return Response.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
