import { z } from "zod";

// Zod 4 probes for `new Function` support to JIT-compile schemas. Our Content-Security-Policy
// forbids eval (no 'unsafe-eval'), so turn the JIT off: validation still works, without CSP violations.
z.config({ jitless: true });