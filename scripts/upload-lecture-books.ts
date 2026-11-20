import "dotenv/config";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  LECTURE_BOOK_SLICES,
  LECTURE_BOOKS_BUCKET,
  lectureBookPath,
} from "@/lib/workstation/lecture-books";

/**
 * Slices each lecture's pages out of its lecture book and uploads them to the
 * private `lecture-books` bucket (macOS only: slicing uses PDFKit).
 *
 *   pnpm books:upload            # every book whose PDF is in Doc/study-resource
 *   pnpm books:upload english    # one book folder
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY in .env. Slices are kept in Doc/lecture-books
 * (git-ignored); uploading again replaces them.
 */
const SOURCE_DIR = "Doc/study-resource";
const OUT_DIR = "Doc/lecture-books";
const PAGE_WIDTH_PX = "1240";
const JPEG_QUALITY = "0.55";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  const only = process.argv[2];

  const slicer = join(OUT_DIR, ".pdf-slice");
  mkdirSync(OUT_DIR, { recursive: true });
  execFileSync("swiftc", ["-O", "scripts/pdf-slice.swift", "-o", slicer], { stdio: "inherit" });

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b) => b.name === LECTURE_BOOKS_BUCKET)) {
    const { error } = await supabase.storage.createBucket(LECTURE_BOOKS_BUCKET, {
      public: false,
      allowedMimeTypes: ["application/pdf"],
    });
    if (error) throw error;
    console.log(`Created private bucket ${LECTURE_BOOKS_BUCKET}`);
  }

  // Lectures sharing the same pages share one sliced file per path anyway.
  let uploaded = 0;
  let bytes = 0;
  for (const [title, slice] of Object.entries(LECTURE_BOOK_SLICES)) {
    if (only && slice.book.folder !== only) continue;
    const source = join(SOURCE_DIR, slice.book.file);
    if (!existsSync(source)) {
      console.warn(`skip ${title}: ${source} not found`);
      continue;
    }
    const path = lectureBookPath(title)!;
    const out = join(OUT_DIR, path);
    mkdirSync(join(OUT_DIR, slice.book.folder), { recursive: true });
    execFileSync(slicer, [source, out, slice.pages, PAGE_WIDTH_PX, JPEG_QUALITY], {
      stdio: ["ignore", "ignore", "ignore"],
    });
    const file = readFileSync(out);
    const { error } = await supabase.storage
      .from(LECTURE_BOOKS_BUCKET)
      .upload(path, file, { contentType: "application/pdf", upsert: true });
    if (error) throw new Error(`${path}: ${error.message}`);
    uploaded += 1;
    bytes += file.length;
    console.log(`${path}  pages ${slice.pages}  ${(file.length / 1e6).toFixed(1)} MB`);
  }
  console.log(`Uploaded ${uploaded} lecture PDFs, ${(bytes / 1e6).toFixed(0)} MB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
