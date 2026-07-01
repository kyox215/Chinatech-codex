import type { DefaultOptions } from "@tanstack/react-query";

export const CACHE_TIMES = {
  hotList: 15_000,
  detail: 30_000,
  shell: 60_000,
  stats: 60_000,
  search: 90_000,
  settings: 300_000,
  options: 300_000,
  workflow: 300_000,
} as const;

export const repairDeskQueryDefaultOptions = {
  queries: {
    staleTime: CACHE_TIMES.detail,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  },
} satisfies DefaultOptions;
