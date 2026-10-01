// An honest loading state, never a substitute technical illustration.
export function AdvisoryImagePending({ logoUrl }: { logoUrl: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: "100%", height: "100%", padding: 80, background: "#f5f7fa", color: "#172131" }}>
      {/* ImageResponse needs a native image element. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoUrl} alt="QCS" width={240} height={80} style={{ objectFit: "contain", marginBottom: 48 }} />
      <div style={{ display: "flex", fontSize: 44, fontWeight: 700 }}>Advisory illustration pending</div>
      <div style={{ display: "flex", fontSize: 28, marginTop: 24 }}>Read the advisory for the verified technical details.</div>
    </div>
  );
}
