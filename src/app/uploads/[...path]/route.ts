import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";

import { getLocalImagePath } from "@/features/images/storage";

type LocalImageRouteProps = {
  params: Promise<{ path: string[] }>;
};

export async function GET(
  _request: Request,
  { params }: LocalImageRouteProps,
) {
  const { path } = await params;
  const imagePath = getLocalImagePath(path);

  if (!imagePath) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const image = await readFile(imagePath);

    return new NextResponse(image, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
