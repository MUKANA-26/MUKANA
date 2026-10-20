// Shared set-up for the demo-data scripts. Everything the seed creates is tagged with DEMO_DOMAIN so `remove.mjs` can delete it in one go.
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CACHE = path.join(path.dirname(fileURLToPath(import.meta.url)), ".cache");
if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });

export const DEMO_DOMAIN = "demo.mukana.test";
export const DEMO_PASSWORD = "Mukana-Demo-2026!";

function loadEnv() {
  const file = path.join(ROOT, ".env.local");
  const env = { ...process.env };
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      env[line.slice(0, i)] = line.slice(i + 1).trim();
    }
  }
  return env;
}
const env = loadEnv();
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (.env.local)");
export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
export const svc = createClient(SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

/** Small deterministic random generator so a re-run produces the same people. */
export function rng(seed = 20261020) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min, max) => Math.floor(next() * (max - min + 1)) + min;
  const pick = (arr) => arr[Math.floor(next() * arr.length)];
  const chance = (p) => next() < p;
  const shuffle = (arr) => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const sample = (arr, n) => shuffle(arr).slice(0, Math.min(n, arr.length));
  return { next, int, pick, chance, shuffle, sample };
}

/** Runs async jobs with limited concurrency. */
export async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        results[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return results;
}

export const day = 86_400_000;
export const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);
export const log = (...a) => console.log(...a);
export function must(res, label) {
  if (res?.error) throw new Error(`${label}: ${res.error.message}`);
  return res?.data;
}
