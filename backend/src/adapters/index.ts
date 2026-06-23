import type { Adapters } from "./types.js";
import { mockAdapters } from "./mock.js";
// Returns mock adapters unless a vendor key is present. Wire real impls here in Layer 3:
//   if (process.env.HOUSECANARY_API_KEY) adapters.avm = new HouseCanaryAvm(...)
export function getAdapters(): Adapters {
  const a: Adapters = { ...mockAdapters };
  // TODO Layer 3: replace individual providers when keys exist.
  return a;
}
export const LIVE = {
  avm: !!process.env.HOUSECANARY_API_KEY || !!process.env.ATTOM_API_KEY,
  skipTrace: !!process.env.BATCHDATA_API_KEY,
  mls: !!process.env.BRIDGE_MLS_TOKEN,
};
