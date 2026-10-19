import { ImageResponse } from "next/og";
import { TYPE_LABEL, type OpportunityType } from "@/lib/opportunity-types";
import { createAnonClient } from "@/lib/supabase/server";

export const alt = "Mukana opportunity";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 300;

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let title = "Opportunity on Mukana";
  let company = "Mukana";
  let meta = "Your Opportunity Starts Here.";
  let verified = false;
  if (/^[0-9a-f-]{36}$/i.test(id) && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const { data } = await createAnonClient()
      .from("opportunities")
      .select("title, type, location, deadline, stipend_type, companies(name, verification_status)")
      .eq("id", id)
      .maybeSingle();
    if (data) {
      const c = (Array.isArray(data.companies) ? data.companies[0] : data.companies) as { name?: string; verification_status?: string } | null;
      title = data.title;
      company = c?.name ?? company;
      verified = c?.verification_status === "approved";
      meta = `${TYPE_LABEL[data.type as OpportunityType] ?? "Opportunity"} · ${data.location} · ${data.stipend_type === "paid" ? "Paid" : "Unpaid"} · Apply by ${data.deadline}`;
    }
  }
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#ffffff", padding: 64, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", width: 56, height: 56, borderRadius: 14, background: "#032552", color: "#F8851B", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 800 }}>M</div>
          <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: "#032552" }}>Mukana</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: title.length > 60 ? 54 : 68, fontWeight: 800, color: "#032552", lineHeight: 1.1 }}>{title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 24, fontSize: 38, color: "#034B85", fontWeight: 600 }}>
            {company}
            {verified ? <span style={{ display: "flex", fontSize: 24, background: "#e3f4e5", color: "#08502f", padding: "4px 16px", borderRadius: 999 }}>Verified</span> : null}
          </div>
          <div style={{ display: "flex", marginTop: 16, fontSize: 28, color: "#4a5a73" }}>{meta}</div>
        </div>
        <div style={{ display: "flex", height: 10, width: "100%", background: "linear-gradient(90deg,#032552,#034B85,#34973A,#F8851B,#FFB92D)", borderRadius: 6 }} />
      </div>
    ),
    size,
  );
}
