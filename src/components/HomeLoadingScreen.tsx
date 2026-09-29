"use client";

import { usePathname } from "next/navigation";
import LoadingScreen from "./LoadingScreen";

/** Keep the loader at the layout level so its server-rendered shell can cover
 * the header without waiting for a client-side portal. */
export default function HomeLoadingScreen() {
  return usePathname() === "/" ? <LoadingScreen /> : null;
}
