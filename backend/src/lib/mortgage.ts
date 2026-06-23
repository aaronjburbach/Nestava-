export function monthlyPI(loan: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 100 / 12, n = years * 12;
  return r > 0 ? loan * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) : loan / n;
}
export function scenario(kind: string, i: any) {
  const price = +i.price || 0, down = (+i.downPct || 0) / 100, rate = +i.rate || 0, term = +i.term || 30;
  const loan = price * (1 - down), pi = monthlyPI(loan, rate, term);
  if (kind === "afford") return { payment: pi, suggestedIncome: pi / 0.28 };
  if (kind === "refi") { const oldPi = pi * 1.16; return { payment: pi, monthlySavings: oldPi - pi }; }
  if (kind === "dscr") { const rent = +i.rent || 0; return { payment: pi, dscr: rent / pi, cashFlow: rent - pi }; }
  return { payment: pi, loan, totalInterest: pi * term * 12 - loan };
}
