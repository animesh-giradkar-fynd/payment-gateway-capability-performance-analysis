import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type CellState = 'live' | 'beta' | 'available' | 'not-offered';

export type CapabilityRow = { id: string; label: string };
export type CapabilityBand = { id: string; label: string; rows: CapabilityRow[] };

export type OrchestrationRow = {
  id: string;
  label: string;
  description: string;
  status: 'live' | 'beta' | 'planned';
};

export type CapabilitiesData = {
  schemaVersion: number;
  lastUpdated: string;
  bands: CapabilityBand[];
  /**
   * Per-PG capability state. Keyed by gateway display name → row id → cell state.
   * Cells not present are treated as 'not-offered' by the renderer.
   */
  gateways: Record<string, Record<string, CellState>>;
  orchestration: { rows: OrchestrationRow[] };
};

const JSON_PATH = process.env.CAPABILITIES_JSON_PATH ?? path.join(process.cwd(), 'data/capabilities.json');

/**
 * Reads + parses the curated capability matrix from `data/capabilities.json`.
 * Strips the `_comment` and `_comments` keys that document fields for human readers.
 */
export async function loadCapabilities(): Promise<CapabilitiesData> {
  const raw = await readFile(JSON_PATH, 'utf-8');
  const parsed = JSON.parse(raw);

  // Normalize: gateways may contain `_comment` strings (per the JSON template). Strip them
  // so the renderer only sees real PG keys.
  const cleanGateways: Record<string, Record<string, CellState>> = {};
  for (const [name, cells] of Object.entries(parsed.gateways ?? {})) {
    if (name.startsWith('_')) continue;
    if (!cells || typeof cells !== 'object') continue;
    cleanGateways[name] = cells as Record<string, CellState>;
  }

  return {
    schemaVersion: parsed.schemaVersion ?? 1,
    lastUpdated: parsed.lastUpdated ?? '',
    bands: parsed.bands ?? [],
    gateways: cleanGateways,
    orchestration: { rows: parsed.orchestration?.rows ?? [] },
  };
}

/** Resolve a cell — undefined cells fall through to 'not-offered'. */
export function cellState(
  data: CapabilitiesData,
  gateway: string,
  rowId: string,
): CellState {
  return data.gateways[gateway]?.[rowId] ?? 'not-offered';
}
