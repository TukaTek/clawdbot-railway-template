// File-based persistence for fleet instance metadata.
// Stores data in /data/fleet.json with atomic writes and timestamped backups.

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR || "/data";
const STORE_PATH = path.join(DATA_DIR, "fleet.json");

function emptyStore() {
  return { version: 1, instances: {} };
}

export function load() {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return emptyStore();
  }
}

export function save(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  // Create timestamped backup if file exists.
  if (fs.existsSync(STORE_PATH)) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const bakPath = path.join(DATA_DIR, `fleet.bak-${ts}.json`);
    try {
      fs.copyFileSync(STORE_PATH, bakPath);
    } catch {
      // Best-effort backup.
    }
  }

  // Atomic write: write to tmp, rename over original.
  const tmpPath = STORE_PATH + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, STORE_PATH);
}

export function getAllInstances() {
  const data = load();
  return Object.values(data.instances || {});
}

export function getInstance(id) {
  const data = load();
  return data.instances[id] || null;
}

export function addInstance(instance) {
  const data = load();
  data.instances[instance.id] = instance;
  save(data);
  return instance;
}

export function updateInstance(id, patch) {
  const data = load();
  if (!data.instances[id]) return null;
  Object.assign(data.instances[id], patch);
  save(data);
  return data.instances[id];
}

export function removeInstance(id) {
  const data = load();
  const removed = data.instances[id] || null;
  delete data.instances[id];
  save(data);
  return removed;
}
