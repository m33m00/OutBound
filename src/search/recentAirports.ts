import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/**
 * The airports you picked last in the From and To pickers, newest first (round 214, John: "Fix all of them",
 * on the picker's unlabeled list). Kept on the phone, shared by every picker.
 */
export const RECENT_AIRPORTS_KEY = 'outbound.recentAirports.v1';
/** How many recent picks the picker shows above the full list. */
export const RECENT_LIMIT = 3;

let recent: string[] | null = null;
const listeners = new Set<(codes: string[]) => void>();

/** `codes` with `code` moved to the front, at most RECENT_LIMIT long. */
export function withRecent(codes: readonly string[], code: string): string[] {
  return [code, ...codes.filter((c) => c !== code)].slice(0, RECENT_LIMIT);
}

async function load(): Promise<string[]> {
  if (recent) return recent;
  try {
    const raw = await AsyncStorage.getItem(RECENT_AIRPORTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    recent = Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string').slice(0, RECENT_LIMIT) : [];
  } catch {
    recent = [];
  }
  return recent;
}

/** Remembers a pick, for every open picker and the next launch. */
export async function rememberAirport(code: string): Promise<void> {
  const next = withRecent(await load(), code);
  recent = next;
  listeners.forEach((l) => l(next));
  AsyncStorage.setItem(RECENT_AIRPORTS_KEY, JSON.stringify(next)).catch(() => {});
}

/** The recent picks, newest first; empty until they've loaded. */
export function useRecentAirports(): string[] {
  const [codes, setCodes] = useState<string[]>(recent ?? []);
  useEffect(() => {
    let live = true;
    load().then((c) => live && setCodes(c));
    listeners.add(setCodes);
    return () => {
      live = false;
      listeners.delete(setCodes);
    };
  }, []);
  return codes;
}

/** Tests only. */
export function resetRecentAirportsForTests(): void {
  recent = null;
  listeners.clear();
}
