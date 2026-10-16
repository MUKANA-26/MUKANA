"use client";

import { useEffect, useState } from "react";

/**
 * True once React has hydrated. Forms disable their submit button until then, so a fast click
 * (or Enter) before the page's JavaScript is ready can't fall back to a native browser submit,
 * which would put field values (e.g. a password) into the URL.
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}