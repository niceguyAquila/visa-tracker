import { supabase } from "./supabase";

export const PASSPORT_PHOTO_BUCKET = "passport-photos";
export const PASSPORT_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const PASSPORT_PHOTO_MAX_EDGE = 1200;

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function passportPhotoPath(orgId: string, customerId: string): string {
  return `${orgId}/${customerId}/photo.jpg`;
}

export function isPassportPhotoFile(file: File): boolean {
  if (PHOTO_TYPES.has(file.type)) return true;
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp")
  );
}

function canvasJpeg(
  bitmap: ImageBitmap,
  maxEdge: number,
  quality: number
): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Couldn’t prepare the photo."));
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Couldn’t prepare the photo."));
        else resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

async function compressPassportPhoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Use a JPEG, PNG, or WebP image.");
  }
  try {
    let blob = await canvasJpeg(bitmap, PASSPORT_PHOTO_MAX_EDGE, 0.85);
    if (blob.size > PASSPORT_PHOTO_MAX_BYTES) {
      blob = await canvasJpeg(bitmap, PASSPORT_PHOTO_MAX_EDGE, 0.7);
    }
    if (blob.size > PASSPORT_PHOTO_MAX_BYTES) {
      blob = await canvasJpeg(bitmap, 800, 0.7);
    }
    if (blob.size > PASSPORT_PHOTO_MAX_BYTES) {
      throw new Error(
        "That photo is still too large after resizing. Try a smaller image."
      );
    }
    return blob;
  } finally {
    bitmap.close();
  }
}

export async function uploadPassportPhoto(
  orgId: string,
  customerId: string,
  file: File
): Promise<string> {
  if (!isPassportPhotoFile(file)) {
    throw new Error("Use a JPEG, PNG, or WebP image.");
  }
  const blob = await compressPassportPhoto(file);
  const path = passportPhotoPath(orgId, customerId);
  const { error } = await supabase.storage
    .from(PASSPORT_PHOTO_BUCKET)
    .upload(path, blob, {
      upsert: true,
      contentType: "image/jpeg",
      cacheControl: "60",
    });
  if (error) throw new Error(error.message);
  return path;
}

export async function signedPassportPhotoUrl(
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(PASSPORT_PHOTO_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function removePassportPhoto(path: string | null | undefined) {
  if (!path) return;
  const { error } = await supabase.storage.from(PASSPORT_PHOTO_BUCKET).remove([path]);
  if (error) throw new Error(error.message);
}

/** Copy another customer's photo onto this customer. Does not change the database row. */
export async function copyPassportPhoto(
  fromPath: string,
  orgId: string,
  customerId: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(PASSPORT_PHOTO_BUCKET)
    .download(fromPath);
  if (error || !data) {
    throw new Error(error?.message ?? "Couldn’t copy the passport photo.");
  }
  const path = passportPhotoPath(orgId, customerId);
  const { error: upErr } = await supabase.storage
    .from(PASSPORT_PHOTO_BUCKET)
    .upload(path, data, {
      upsert: true,
      contentType: "image/jpeg",
      cacheControl: "60",
    });
  if (upErr) throw new Error(upErr.message);
  return path;
}
