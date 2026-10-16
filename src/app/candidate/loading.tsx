import { Skeleton, SkeletonList } from "@/components/ui/misc";

export default function Loading() {
  return (
    <div>
      <Skeleton className="mb-2 h-7 w-48" />
      <Skeleton className="mb-6 h-4 w-72 max-w-full" />
      <SkeletonList />
    </div>
  );
}
