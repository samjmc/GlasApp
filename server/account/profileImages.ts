/**
 * Profile pictures on disk, served from /uploads. Each file is named `<user id>-<time><ext>`,
 * so a user's files can be found (and erased) by prefix.
 */
import fs from 'fs';
import path from 'path';

export const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

/**
 * The extension comes from this list, never from the uploaded file name: `/uploads` is served
 * from our own origin, so a file saved as `.html` would run as a page on the site.
 */
export const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/** Delete every picture this user has uploaded, except `keep` (a file name). */
export async function removeProfileImages(userId: string, keep?: string): Promise<void> {
  const names = await fs.promises.readdir(UPLOAD_DIR).catch(() => [] as string[]);
  await Promise.all(
    names
      .filter((name) => name.startsWith(`${userId}-`) && name !== keep)
      .map((name) => fs.promises.rm(path.join(UPLOAD_DIR, name), { force: true })),
  );
}
