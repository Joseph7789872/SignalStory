import { ImageResponse } from "next/og";

// Replaces the previously-referenced static /og.png (which did not exist and 404'd
// for crawlers). Next renders this at /opengraph-image and auto-injects the
// og:image + twitter:image tags site-wide.
export const runtime = "edge";
export const alt = "SignalStory — founder-quality content, context first";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0A0A0A",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "10px",
              height: "64px",
            }}
          >
            <div style={{ width: "12px", height: "20px", backgroundColor: "#FAFAFA", borderRadius: "6px" }} />
            <div style={{ width: "12px", height: "40px", backgroundColor: "#FAFAFA", borderRadius: "6px" }} />
            <div style={{ width: "12px", height: "64px", backgroundColor: "#FAFAFA", borderRadius: "6px" }} />
            <div style={{ width: "12px", height: "32px", backgroundColor: "#FAFAFA", borderRadius: "6px" }} />
          </div>
          <div style={{ color: "#FAFAFA", fontSize: "40px", fontWeight: 700 }}>SignalStory</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              color: "#FAFAFA",
              fontSize: "68px",
              fontWeight: 800,
              lineHeight: 1.1,
            }}
          >
            <span>Founder-quality content,</span>
            <span>context first.</span>
          </div>
          <div style={{ display: "flex", color: "#A1A1AA", fontSize: "34px" }}>
            Turn company signals into thought leadership. Writing comes last.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
