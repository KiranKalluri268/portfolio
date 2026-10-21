import { DetailSkeleton } from "@/components/skeleton/Skeleton";

export default function Loading() {
  return <DetailSkeleton label="Loading the role" hero={false} width="max-w-5xl" />;
}
