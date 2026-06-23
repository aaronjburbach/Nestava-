// The Buyer Defense Report engine. Pure + deterministic so it runs identically on the
// server (PDF + audit) and the client (preview). In Layer 3 the `property.data` is
// populated by live adapters (FEMA/ATTOM/HouseCanary/DataTree/GreatSchools/First Street);
// here it reads whatever is stored on the property row.
export type Property = {
  address: string; city?: string; beds?: number; baths?: number; sqft?: number;
  year?: number; floodZone?: string; listPrice?: number;
  data?: { avm?: any; comps?: any[]; permits?: any[]; hazards?: any[]; owner?: any; insights?: [string,string,string,string][] };
};

export function riskBand(score: number) {
  return score >= 6.5 ? "review-carefully" : score >= 4.5 ? "moderate" : "generally clean";
}

// Composite risk score (0–10, higher = riskier) from hazards + open permits + price gap.
export function computeRisk(p: Property): number {
  let s = 2;
  const fz = (p.floodZone || "").toUpperCase();
  if (fz.includes("VE")) s += 3.5; else if (fz.includes("AE")) s += 2.2;
  const openPermits = (p.data?.permits || []).filter((x: any) => x[3] === "red").length;
  s += openPermits * 1.4;
  const avm = p.data?.avm?.consensus, list = p.listPrice;
  if (avm && list && list > avm) s += Math.min(1.5, ((list - avm) / avm) * 30);
  return Math.max(0, Math.min(10, +s.toFixed(1)));
}

export function generateBuyerDefense(p: Property, type = "Buyer Defense Report") {
  const score = p.data?.insights ? computeRisk(p) : computeRisk(p);
  const insights = p.data?.insights || [];
  const flags = insights.filter((i) => i[0] !== "good");
  const consensus = p.data?.avm?.consensus;
  const narrative =
    `This ${p.year ?? ""} property carries a ${riskBand(score)} risk profile (score ${score}/10). ` +
    `It sits in FEMA Zone ${p.floodZone ?? "—"}; the Nestava 3-AVM consensus is ` +
    `${consensus ? "$" + consensus.toLocaleString() : "n/a"} against a list of ` +
    `${p.listPrice ? "$" + p.listPrice.toLocaleString() : "n/a"}. ` +
    (flags.length
      ? "Items to address before offering: " + flags.map((f) => f[1].toLowerCase()).slice(0, 3).join(", ") + "."
      : "No material red flags surfaced in title, permits, or hazards.");
  return {
    type, address: p.address, riskScore: score, narrative,
    facts: { value: consensus, beds: p.beds, baths: p.baths, sqft: p.sqft, year: p.year, flood: p.floodZone },
    hazards: p.data?.hazards || [], permits: p.data?.permits || [],
    comps: p.data?.comps || [], owner: p.data?.owner || null, flags,
    sources: ["FEMA NFHL", "ATTOM", "HouseCanary", "DataTree", "GreatSchools", "First Street Foundation"],
    generatedAt: new Date().toISOString(),
  };
}
