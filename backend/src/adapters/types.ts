// Layer-3 vendor seam. Every external data source implements one of these interfaces.
// Going live = swap the mock implementation for the real one in adapters/index.ts — the
// API and report engine never change.
export interface AvmProvider { value(address: string): Promise<{ source: string; value: number; low: number; high: number }[]>; }
export interface FloodProvider { zone(address: string): Promise<{ zone: string; annualPct: number; insuranceRequired: boolean }>; }
export interface PermitProvider { permits(address: string): Promise<[string, string, string, "good" | "red"][]>; }
export interface TitleProvider { title(address: string): Promise<{ owner: string; tenure: string; liens: boolean; transfers: number }>; }
export interface SchoolProvider { schools(address: string): Promise<{ name: string; rating: number }[]>; }
export interface ClimateProvider { risk(address: string): Promise<{ label: string; tone: "good" | "amber" | "red" }>; }
export interface SkipTraceProvider { trace(address: string, owner: string): Promise<{ phones: string[]; emails: string[]; dnc: boolean }>; }
export interface MlsProvider { search(query: Record<string, unknown>): Promise<any[]>; }
export interface Adapters {
  avm: AvmProvider; flood: FloodProvider; permits: PermitProvider; title: TitleProvider;
  schools: SchoolProvider; climate: ClimateProvider; skipTrace: SkipTraceProvider; mls: MlsProvider;
}
