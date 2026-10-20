const UPLOAD_PATH = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(?!(?:[a-z]{1,3}_[^/,]+,?)+\/)/;

/** Project images are uploaded to Cloudinary at whatever size they were made —
 *  two of them are 5MB PNGs — and were fetched exactly like that, even for a
 *  card a few hundred pixels wide. Cloudinary resizes and re-encodes on
 *  request when the URL says so: `f_auto` picks AVIF or WebP for the browser
 *  asking, `q_auto` its own quality setting, `c_limit` shrinks to the width
 *  without ever enlarging. Anything that is not a plain Cloudinary upload URL,
 *  or already names its own transformation, is returned unchanged. */
export function cloudinaryImage(src: string, width: number) {
  return src.replace(UPLOAD_PATH, `$1f_auto,q_auto,c_limit,w_${Math.round(width)}/`);
}

/** The widest a project image is ever drawn into a WebGL card texture: the
 *  wide card is 1200 layout units across, and the image panel sits inside it. */
export const CARD_TEXTURE_IMAGE_WIDTH = 1280;
