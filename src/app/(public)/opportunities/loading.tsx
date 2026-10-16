import { Skeleton, SkeletonList } from "@/components/ui/misc";

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Skeleton className="mb-6 h-8 w-56" />
      <SkeletonList />
    </div>
  );
}
