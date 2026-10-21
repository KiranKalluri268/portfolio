import { Bone } from "./Skeleton";

/** The skill web's shape: a centre and a ring of branches around it. */
export default function SkillsWebSkeleton() {
  const branches = 8;
  return (
    <main className="relative z-10 flex h-[100svh] items-center justify-center overflow-hidden text-white" aria-busy="true">
      <p className="sr-only" role="status">Loading the skills</p>
      <div aria-hidden="true" className="relative h-[min(70vw,560px)] w-[min(70vw,560px)]">
        <Bone className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full" />
        {Array.from({ length: branches }, (_, i) => {
          const angle = (i / branches) * Math.PI * 2 - Math.PI / 2;
          return (
            <Bone
              key={i}
              className="absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${50 + 42 * Math.cos(angle)}%`, top: `${50 + 42 * Math.sin(angle)}%` }}
            />
          );
        })}
      </div>
    </main>
  );
}
