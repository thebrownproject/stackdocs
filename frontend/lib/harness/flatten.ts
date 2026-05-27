// Flatten nested objects to leaf dot-paths and rebuild them.
// Arrays and primitives are treated as leaves (compared as whole values).

export function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, flatten(value as Record<string, unknown>, path));
    } else {
      out[path] = value;
    }
  }
  return out;
}

/** Set a dot-path key on a nested object, creating intermediate objects. */
export function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let node = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (node[p] === undefined || node[p] === null || typeof node[p] !== "object") {
      node[p] = {};
    }
    node = node[p] as Record<string, unknown>;
  }
  node[parts[parts.length - 1]] = value;
}
