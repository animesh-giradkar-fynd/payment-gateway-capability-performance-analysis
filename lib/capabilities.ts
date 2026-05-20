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
   * Per-PG capability state for currently-integrated gateways. Keyed by gateway display
   * name → row id → cell state. Cells not present default to 'not-offered'.
   */
  gateways: Record<string, Record<string, CellState>>;
  /**
   * Roadmap PGs (PRD Q1 / D003) — gateways Fynd plans to integrate but hasn't yet. Rendered
   * in a visually separated band below the main matrix. Same cell-state semantics as
   * `gateways`; values are typically 'available' (gateway offers it, Fynd will integrate)
   * or 'not-offered'.
   */
  roadmapGateways: Record<string, Record<string, CellState>>;
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

  // Normalize: gateway maps may contain `_comment` strings (per the JSON template). Strip
  // them so the renderer only sees real PG keys.
  const cleanGateways = stripCommentKeys(parsed.gateways);
  const cleanRoadmap = stripCommentKeys(parsed.roadmapGateways);

  return {
    schemaVersion: parsed.schemaVersion ?? 1,
    lastUpdated: parsed.lastUpdated ?? '',
    bands: parsed.bands ?? [],
    gateways: cleanGateways,
    roadmapGateways: cleanRoadmap,
    orchestration: { rows: parsed.orchestration?.rows ?? [] },
  };
}

function stripCommentKeys(input: unknown): Record<string, Record<string, CellState>> {
  const out: Record<string, Record<string, CellState>> = {};
  if (!input || typeof input !== 'object') return out;
  for (const [name, cells] of Object.entries(input as Record<string, unknown>)) {
    if (name.startsWith('_')) continue;
    if (!cells || typeof cells !== 'object') continue;
    out[name] = cells as Record<string, CellState>;
  }
  return out;
}

/** Resolve a cell — undefined cells fall through to 'not-offered'. */
export function cellState(
  data: CapabilitiesData,
  gateway: string,
  rowId: string,
): CellState {
  return data.gateways[gateway]?.[rowId] ?? 'not-offered';
}
