import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getAdminSession } from "@/features/auth/server-session";
import {
  ACCEPTED_IMAGE_MIME_TYPES,
  MAX_IMAGE_FILE_SIZE,
} from "@/features/images/image-constants";
import {
  ImageValidationError,
  optimizeProductImage,
} from "@/features/images/image-processing";
import {
  deleteManagedProductImage,
  storeProductImage,
} from "@/features/images/storage";

function hasValidOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }

  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const uploadedFile = formData.get("image");

    if (!(uploadedFile instanceof File)) {
      throw new ImageValidationError("Selecciona una imagen.");
    }

    if (
      !ACCEPTED_IMAGE_MIME_TYPES.includes(
        uploadedFile.type as (typeof ACCEPTED_IMAGE_MIME_TYPES)[number],
      )
    ) {
      throw new ImageValidationError(
        "Formato no permitido. Usa JPG, JPEG, PNG o WEBP.",
      );
    }

    if (uploadedFile.size > MAX_IMAGE_FILE_SIZE) {
      throw new ImageValidationError(
        "La imagen supera el tamaño máximo de 10 MB.",
      );
    }

    const optimizedImage = await optimizeProductImage(
      Buffer.from(await uploadedFile.arrayBuffer()),
    );
    const storedImage = await storeProductImage(optimizedImage);

    return NextResponse.json({
      success: true,
      url: storedImage.desktopUrl,
      mobileUrl: storedImage.mobileUrl,
      width: optimizedImage.width,
      height: optimizedImage.height,
    });
  } catch (error: unknown) {
    if (error instanceof ImageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("No se pudo almacenar la imagen optimizada.", error);
    return NextResponse.json(
      { error: "No se ha podido subir la imagen. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }

  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { url?: unknown };

    if (typeof body.url !== "string") {
      throw new ImageValidationError("La imagen indicada no es válida.");
    }

    await deleteManagedProductImage(body.url);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof ImageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("No se pudo eliminar la imagen gestionada.", error);
    return NextResponse.json(
      { error: "No se ha podido eliminar la imagen." },
      { status: 500 },
    );
  }
}
