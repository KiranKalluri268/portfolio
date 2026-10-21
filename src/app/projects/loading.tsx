import ProjectsLoading from "@/components/projects/ProjectsLoading";

export default function Loading() {
  return (
    <main className="relative z-10 h-[100svh] overflow-hidden text-white" aria-busy="true">
      <ProjectsLoading view="list" drawn={false} />
    </main>
  );
}
