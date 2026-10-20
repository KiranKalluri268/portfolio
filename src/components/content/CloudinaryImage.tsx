"use client";

import Image, { type ImageLoaderProps, type ImageProps } from "next/image";
import { cloudinaryImage } from "@/lib/cloudinary";

function cloudinaryLoader({ src, width }: ImageLoaderProps) {
  return cloudinaryImage(src, width);
}

/** next/image with Cloudinary doing the resizing: each width in the srcset is
 *  requested from Cloudinary rather than the original upload. A client
 *  component only because a loader is a function, and a server component
 *  cannot hand one to next/image. */
export default function CloudinaryImage({ alt, ...props }: Omit<ImageProps, "loader">) {
  return <Image {...props} alt={alt} loader={cloudinaryLoader} />;
}
