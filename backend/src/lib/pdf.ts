// Server-side report HTML (the input to PDF generation).
// To emit an actual PDF, pipe this HTML through Puppeteer or react-pdf in a worker:
//   const pdf = await page.pdf({ format: "Letter" });   // see README "PDF"
import type { Property } from "./buyerDefense.js";
import { generateBuyerDefense } from "./buyerDefense.js";
export function renderReportHTML(p: Property, brand: { primary?: string; brokerage?: string; license?: string } = {}): string {
  const r = generateBuyerDefense(p);
  const teal = brand.primary || "#0F4C46";
  const row = (k: string, v: string) => `<tr><td style="color:#6e6e62;padding:4px 0">${k}</td><td style="text-align:right;font-weight:600">${v}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{font-family:Inter,Arial,sans-serif;color:#1a1a14;margin:0}
  .band{background:${teal};color:#fff;padding:28px 32px}
  .body{padding:24px 32px}.flag{padding:8px 0;border-top:1px solid #eee}</style></head><body>
  <div class="band"><div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.8">Nestava DD · ${r.type}</div>
  <h1 style="margin:6px 0;font-size:24px">${p.address}</h1><div style="opacity:.85">${p.city || ""} · Risk ${r.riskScore}/10</div></div>
  <div class="body"><p style="line-height:1.6">${r.narrative}</p>
  <table style="width:100%;border-collapse:collapse;margin:14px 0">
  ${row("Consensus value", r.facts.value ? "$" + r.facts.value.toLocaleString() : "n/a")}
  ${row("Beds / Baths", `${p.beds ?? "-"} / ${p.baths ?? "-"}`)}
  ${row("Flood zone", "Zone " + (p.floodZone || "—"))}</table>
  <h3>Risk flags</h3>${(r.flags.length ? r.flags : [["good","No material issues","Title, permits & hazards clean."]] as any)
    .map((f: any) => `<div class="flag"><b>${f[1]}.</b> ${f[2]}</div>`).join("")}
  <p style="font-size:11px;color:#6e6e62;margin-top:20px">Sources: ${r.sources.join(" · ")}. ${brand.brokerage || ""} ${brand.license || ""} · Fair Housing compliant · Equal Housing Opportunity.</p>
  </div></body></html>`;
}
