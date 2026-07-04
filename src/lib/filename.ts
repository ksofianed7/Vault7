/**
 * Apply a filename template to generate the final filename.
 *
 * Supported variables:
 *   {title}   — video title
 *   {author}  — channel/uploader name
 *   {platform}— youtube / tiktok / instagram
 *   {quality} — 1080p / 720p / 130 kbps
 *   {format}  — video / audio
 *   {date}    — current date (YYYY-MM-DD)
 *   {ext}     — file extension (mp4 / mp3)
 *
 * Example: "{title} - {author} ({date}).{ext}"
 *       → "Sunset Drive - Aurora Studio (2026-07-01).mp4"
 */
export function applyFilenameTemplate(
  template: string,
  vars: {
    title: string;
    author: string;
    platform: string;
    quality: string;
    format: string;
    ext: string;
  }
): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let filename = template || "{title}";

  // Replace variables
  filename = filename
    .replace(/\{title\}/gi, vars.title || "vault-download")
    .replace(/\{author\}/gi, vars.author || "unknown")
    .replace(/\{platform\}/gi, vars.platform || "unknown")
    .replace(/\{quality\}/gi, vars.quality || "")
    .replace(/\{format\}/gi, vars.format || "")
    .replace(/\{date\}/gi, date)
    .replace(/\{ext\}/gi, vars.ext || "mp4");

  // Sanitize: remove illegal filename characters
  filename = filename
    .replace(/[<>:"/\\|?*]/g, "") // Windows illegal chars
    .replace(/\s+/g, " ")          // collapse multiple spaces
    .trim()
    .slice(0, 120);                // cap length

  // Ensure extension
  if (!filename.endsWith(`.${vars.ext}`)) {
    filename = `${filename}.${vars.ext}`;
  }

  return filename;
}
