/** The site's public origin. A PDF is read away from the site, so any link
 *  in one to a page here has to be absolute. */
export const SITE_URL = "https://saikirankalluri.dev";

/** A site path ("/projects/elphie") as an absolute URL; anything already
 *  absolute is returned as it is. */
export function absoluteUrl(href: string) {
  return href.startsWith("/") ? `${SITE_URL}${href}` : href;
}
