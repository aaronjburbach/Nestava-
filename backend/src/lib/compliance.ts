// Compliance guardrails (TCPA / CAN-SPAM / Fair Housing / state license display).
// These run BEFORE any outreach or AI-generated content is delivered.
export function canAutoContact(contact: { doNotCall?: boolean; tcpaConsentAt?: Date | null }): { ok: boolean; reason?: string } {
  if (contact.doNotCall) return { ok: false, reason: "Contact is on do-not-call (TCPA)." };
  if (!contact.tcpaConsentAt) return { ok: false, reason: "No written TCPA consent on file." };
  return { ok: true };
}

const STEERING = /\b(safe neighborhood|good schools for|family-friendly area|exclusive community|no crime|church|christian|hispanic|black|white|asian neighborhood)\b/i;
export function fairHousingCheck(text: string): { ok: boolean; flagged: string[] } {
  const flagged: string[] = []; const m = text.match(STEERING);
  if (m) flagged.push(m[0]);
  return { ok: flagged.length === 0, flagged };
}

export function appendDisclaimer(body: string, brandKit?: { license?: string; brokerage?: string }): string {
  const lic = brandKit?.license || "[License #]";
  const br = brandKit?.brokerage || "[Brokerage]";
  return `${body}\n\n${br} · ${lic} · Equal Housing Opportunity. Reply STOP to opt out.`;
}

export function canSpamFooter(address = "[Brokerage mailing address]"): string {
  return `\n\n${address} · Unsubscribe: one click in every email.`;
}
