import { Bone, TextBones } from "./Skeleton";

/** The résumé and CV: the back link and download button, then an A4 sheet
 *  scaled to the screen, as PaperViewport draws it. */
export default function SheetSkeleton({ label }: { label: string }) {
  return (
    <main className="relative z-10 min-h-[100svh] px-4 pt-24 pb-10 text-white sm:pt-28" aria-busy="true">
      <p className="sr-only" role="status">{label}</p>
      <div aria-hidden="true" className="mx-auto w-[min(100%,794px)]">
        <div className="mb-6 flex items-center justify-between">
          <Bone className="h-9 w-40 rounded-md" />
          <Bone className="h-9 w-36 rounded-md" />
        </div>
        <div className="aspect-[210/297] w-full rounded-sm border border-white/10 bg-black/60 p-[7%]">
          <Bone className="mx-auto h-8 w-1/2" />
          <Bone className="mx-auto mt-4 h-4 w-2/3" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="mt-[6%]">
              <Bone className="h-5 w-1/4" />
              <TextBones lines={3} className="mt-4" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
