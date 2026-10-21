import ProjectsLoading from "@/components/projects/ProjectsLoading";
import { Bone, DetailSkeleton, SkeletonPage, TextBones } from "./Skeleton";
import SheetSkeleton from "./SheetSkeleton";
import SkillsWebSkeleton from "./SkillsWebSkeleton";

/** The skeleton for a path, or null for a page that has its own way of
 *  arriving (the home page's loading screen) or none worth drawing. The same
 *  shapes the routes' loading.tsx files show. */
export function skeletonFor(pathname: string) {
  if (/^\/projects\/[^/]+$/.test(pathname)) return <DetailSkeleton label="Loading the project" />;
  if (/^\/experience\/[^/]+$/.test(pathname)) return <DetailSkeleton label="Loading the role" hero={false} width="max-w-5xl" />;
  if (/^\/skills\/[^/]+$/.test(pathname)) return <SkillSkeleton />;
  if (pathname === "/projects") {
    return (
      <main className="relative z-10 h-[100svh] overflow-hidden text-white" aria-busy="true">
        <ProjectsLoading view="list" drawn={false} />
      </main>
    );
  }
  if (pathname === "/skills") return <SkillsWebSkeleton />;
  if (pathname === "/resume" || pathname === "/resume/ai") return <SheetSkeleton label="Loading the résumé" />;
  if (pathname === "/cv") return <SheetSkeleton label="Loading the CV" />;
  if (pathname === "/faq") return <FaqSkeleton />;
  return null;
}

export function SkillSkeleton() {
  return (
    <SkeletonPage label="Loading the skill">
      <Bone className="mb-10 h-9 w-24 rounded-full" />
      <div className="grid gap-8 rounded-3xl border border-white/10 bg-black/60 p-7 sm:p-10 md:grid-cols-[auto_1fr] md:items-center">
        <Bone className="h-24 w-24 rounded-2xl" />
        <div>
          <Bone className="h-4 w-40" />
          <Bone className="mt-4 h-10 w-2/3" />
          <TextBones lines={2} className="mt-5" />
        </div>
      </div>
      <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-3xl border border-white/10 bg-black/60 p-6">
            <Bone className="h-5 w-32" />
            <TextBones lines={3} className="mt-5" />
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}

export function FaqSkeleton() {
  return (
    <SkeletonPage label="Loading the questions" width="max-w-4xl">
      <Bone className="h-4 w-36" />
      <Bone className="mt-5 h-12 w-40 sm:h-16" />
      <TextBones lines={2} className="mt-6 max-w-2xl" />
      <div className="mt-14 space-y-4 sm:mt-20">
        {[0, 1, 2, 3, 4].map((i) => <Bone key={i} className="h-16 w-full rounded-2xl" />)}
      </div>
    </SkeletonPage>
  );
}
