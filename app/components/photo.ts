"use client";

export type Photo = { dataUrl: string; base64: string; mediaType: "image/jpeg" };

const MAX_SIDE = 1600;
const QUALITY = 0.82;

/** Shrinks a camera photo to a small JPEG so it uploads quickly on mobile data. */
export async function preparePhoto(file: File): Promise<Photo> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
    return { dataUrl, base64: dataUrl.slice(dataUrl.indexOf(",") + 1), mediaType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}
