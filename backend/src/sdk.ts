// Typed client the Layer 1 frontend imports to talk to the API.
// Usage:  const sc = createClient("https://api.nestava.app", () => clerk.session.getToken());
export function createClient(baseUrl: string, getToken: () => Promise<string | null> | string) {
  const call = async (path: string, init: RequestInit = {}) => {
    const token = await getToken();
    const res = await fetch(baseUrl + path, { ...init, headers: { "content-type": "application/json", authorization: token ? `Bearer ${token}` : "", ...(init.headers || {}) } });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  };
  return {
    runDD: (address: string, city?: string) => call("/v1/dd/run", { method: "POST", body: JSON.stringify({ address, city }) }),
    buyerDefense: (address: string, type?: string) => call("/v1/reports/buyer-defense", { method: "POST", body: JSON.stringify({ address, type }) }),
    contacts: () => call("/v1/contacts"),
    addContact: (data: any) => call("/v1/contacts", { method: "POST", body: JSON.stringify(data) }),
    enroll: (id: string) => call(`/v1/contacts/${id}/enroll`, { method: "POST" }),
    generateMarketing: (kind: string, body: string) => call("/v1/marketing/generate", { method: "POST", body: JSON.stringify({ kind, body }) }),
    sites: () => call("/v1/sites"),
    prospect: () => call("/v1/prospect"),
    skipTrace: (id: string) => call(`/v1/prospect/${id}/skiptrace`, { method: "POST" }),
    mortgage: (kind: string, inputs: any) => call("/v1/mortgage/scenario", { method: "POST", body: JSON.stringify({ kind, inputs }) }),
    transactions: () => call("/v1/transactions"),
    tasks: () => call("/v1/tasks"),
    keys: () => call("/v1/keys"),
    createKey: (label: string) => call("/v1/keys", { method: "POST", body: JSON.stringify({ label }) }),
  };
}
