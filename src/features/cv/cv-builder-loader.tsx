"use client";

import dynamic from "next/dynamic";
import { SkeletonList } from "@/components/ui/misc";

// The PDF engine is large, so it only loads on this page and never on the server.
export const CvBuilderLoader = dynamic(() => import("./cv-builder").then((m) => m.CvBuilder), {
  ssr: false,
  loading: () => <SkeletonList count={3} />,
});
