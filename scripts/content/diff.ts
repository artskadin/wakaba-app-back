import { stableStringify } from './snapshot';
import { DiffResult, EntityDiff, Snapshot } from './types';

export function diffSnapshots(
  desired: Snapshot,
  current: Snapshot,
): DiffResult {
  const keys = Object.keys(desired) as (keyof Snapshot)[];
  const result = {} as DiffResult;

  for (const key of keys) {
    result[key] = diffMaps(desired[key], current[key]);
  }

  return result;
}

function diffMaps(
  desired: Map<string, unknown>,
  current: Map<string, unknown>,
): EntityDiff {
  const create: string[] = [];
  const update: string[] = [];
  const remove: string[] = [];

  for (const [id, val] of desired) {
    if (!current.has(id)) {
      create.push(id);
    } else if (stableStringify(val) !== stableStringify(current.get(id))) {
      update.push(id);
    }
  }

  for (const id of current.keys()) {
    if (!desired.has(id)) {
      remove.push(id);
    }
  }

  return { create, update, remove };
}
