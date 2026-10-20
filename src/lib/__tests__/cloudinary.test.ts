import { describe, expect, it } from "vitest";
import { cloudinaryImage } from "../cloudinary";

const UPLOAD = "https://res.cloudinary.com/dytobweya/image/upload/v1790669616/Gemini.png";

describe("cloudinaryImage", () => {
  it("asks Cloudinary for a resized, re-encoded copy", () => {
    expect(cloudinaryImage(UPLOAD, 1280)).toBe(
      "https://res.cloudinary.com/dytobweya/image/upload/f_auto,q_auto,c_limit,w_1280/v1790669616/Gemini.png",
    );
  });

  it("leaves a URL that already names a transformation alone", () => {
    const transformed = "https://res.cloudinary.com/dytobweya/image/upload/w_300,c_fill/v1/x.png";
    expect(cloudinaryImage(transformed, 1280)).toBe(transformed);
  });

  it("leaves anything that is not a Cloudinary image upload alone", () => {
    expect(cloudinaryImage("/images/local.png", 640)).toBe("/images/local.png");
    const video = "https://res.cloudinary.com/dytobweya/video/upload/v1/clip.webm";
    expect(cloudinaryImage(video, 640)).toBe(video);
  });
});
