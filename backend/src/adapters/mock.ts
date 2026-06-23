import type { Adapters } from "./types.js";
// Deterministic mock data so the whole platform runs end-to-end with zero vendor contracts.
const h = (s: string) => { let x = 0; for (const c of s) x = (x * 31 + c.charCodeAt(0)) | 0; return Math.abs(x); };
export const mockAdapters: Adapters = {
  avm: { async value(a) { const b = 320000 + (h(a) % 240000); return [
    { source: "HouseCanary", value: b - 7000, low: b - 20000, high: b + 6000 },
    { source: "ATTOM", value: b + 9000, low: b - 9000, high: b + 24000 },
    { source: "Nestava Internal", value: b, low: b - 8000, high: b + 8000 }]; } },
  flood: { async zone(a) { const z = ["X", "AE", "VE"][h(a) % 3]; return { zone: z, annualPct: z === "X" ? 0.2 : 1, insuranceRequired: z !== "X" }; } },
  permits: { async permits() { return [["Roof replacement", "Coastal Roofing LLC", "good"], ["Deck addition", "Owner / unpermitted", "red"]] as any; } },
  title: { async title() { return { owner: "Pamela R. Hendricks", tenure: "8 yrs", liens: false, transfers: 4 }; } },
  schools: { async schools() { return [{ name: "Wrightsville Beach Elementary", rating: 8 }, { name: "Hoggard High", rating: 7 }]; } },
  climate: { async risk() { return { label: "Moderate — storm surge", tone: "amber" }; } },
  skipTrace: { async trace() { return { phones: ["+1910555••••"], emails: ["owner@example.com"], dnc: false }; } },
  mls: { async search() { return []; } },
};
