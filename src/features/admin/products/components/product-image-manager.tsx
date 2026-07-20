"use client";

import {
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  ImageOff,
  LoaderCircle,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import {
  ACCEPTED_IMAGE_MIME_TYPES,
  MAX_IMAGE_FILE_SIZE,
  PRODUCT_IMAGE_ACCEPT_ATTRIBUTE,
} from "@/features/images/image-constants";

type ProductImageManagerProps = {
  value: string;
  initialValue: string;
  onChange: (url: string) => void;
  commitRef: RefObject<boolean>;
  disabled?: boolean;
};

type UploadResponse = {
  success?: boolean;
  url?: string;
  error?: string;
};

async function deleteStagedImage(url: string) {
  if (!url) {
    return;
  }

  await fetch("/api/admin/images", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    keepalive: true,
  }).catch(() => undefined);
}

export function ProductImageManager({
  value,
  initialValue,
  onChange,
  commitRef,
  disabled = false,
}: ProductImageManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const stagedUrlRef = useRef(
    value && value !== initialValue ? value : "",
  );
  const objectUrlRef = useRef("");
  const [previewUrl, setPreviewUrl] = useState(value);
  const [progress, setProgress] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const stagedUrl = stagedUrlRef;
    const objectUrl = objectUrlRef;

    return () => {
      xhrRef.current?.abort();

      if (objectUrl.current) {
        URL.revokeObjectURL(objectUrl.current);
      }

      if (stagedUrl.current && !commitRef.current) {
        void deleteStagedImage(stagedUrl.current);
      }
    };
  }, [commitRef]);

  const resetObjectPreview = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = "";
    }
  };

  const uploadFile = (file: File) => {
    setMessage(null);

    if (
      !ACCEPTED_IMAGE_MIME_TYPES.includes(
        file.type as (typeof ACCEPTED_IMAGE_MIME_TYPES)[number],
      )
    ) {
      setMessage({
        type: "error",
        text: "Formato no permitido. Usa JPG, JPEG, PNG o WEBP.",
      });
      return;
    }

    if (file.size > MAX_IMAGE_FILE_SIZE) {
      setMessage({
        type: "error",
        text: "La imagen supera el tamaño máximo de 10 MB.",
      });
      return;
    }

    resetObjectPreview();
    objectUrlRef.current = URL.createObjectURL(file);
    setPreviewUrl(objectUrlRef.current);
    setProgress(0);

    const formData = new FormData();
    formData.set("image", file);
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", "/api/admin/images");
    xhr.responseType = "json";

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setProgress(Math.min(90, Math.round((event.loaded / event.total) * 90)));
      }
    };
    xhr.upload.onload = () => setProgress(95);
    xhr.onerror = () => {
      resetObjectPreview();
      setPreviewUrl(value);
      setProgress(null);
      setMessage({
        type: "error",
        text: "No se ha podido subir la imagen. Inténtalo de nuevo.",
      });
    };
    xhr.onabort = () => {
      resetObjectPreview();
      setPreviewUrl(value);
      setProgress(null);
      setMessage({ type: "error", text: "Subida cancelada." });
    };
    xhr.onload = () => {
      const response = xhr.response as UploadResponse | null;

      if (xhr.status < 200 || xhr.status >= 300 || !response?.url) {
        resetObjectPreview();
        setPreviewUrl(value);
        setProgress(null);
        setMessage({
          type: "error",
          text:
            response?.error ??
            "No se ha podido procesar la imagen seleccionada.",
        });
        return;
      }

      const previousStagedUrl = stagedUrlRef.current;
      resetObjectPreview();
      stagedUrlRef.current = response.url;
      onChange(response.url);
      setPreviewUrl(response.url);
      setProgress(100);
      setMessage({
        type: "success",
        text: "Imagen optimizada. Se aplicará al guardar el producto.",
      });

      if (previousStagedUrl && previousStagedUrl !== response.url) {
        void deleteStagedImage(previousStagedUrl);
      }

      window.setTimeout(() => setProgress(null), 600);
    };
    xhr.send(formData);
  };

  const handleFileSelection = (files: FileList | null) => {
    const file = files?.[0];

    if (file) {
      uploadFile(file);
    }
  };

  const handleRemove = () => {
    xhrRef.current?.abort();
    resetObjectPreview();

    if (stagedUrlRef.current) {
      void deleteStagedImage(stagedUrlRef.current);
      stagedUrlRef.current = "";
    }

    onChange("");
    setPreviewUrl("");
    setProgress(null);
    setMessage({
      type: "success",
      text: "Imagen retirada. El cambio se aplicará al guardar.",
    });
  };

  const isUploading = progress !== null && progress < 100;

  return (
    <div>
      <input type="hidden" name="imageUrl" value={value} />
      <input
        ref={fileInputRef}
        type="file"
        accept={PRODUCT_IMAGE_ACCEPT_ATTRIBUTE}
        className="sr-only"
        disabled={disabled || isUploading}
        onChange={(event) => {
          handleFileSelection(event.target.files);
          event.target.value = "";
        }}
        aria-label="Seleccionar archivo de imagen"
      />

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <div className="relative grid min-h-64 place-items-center bg-stone-100">
          {previewUrl ? (
            // The admin preview accepts both configured remote URLs and managed local URLs.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Vista previa de la imagen del producto"
              className="max-h-80 w-full object-contain"
            />
          ) : (
            <div className="px-6 text-center text-stone-400">
              <ImageOff aria-hidden="true" className="mx-auto size-9" />
              <p className="mt-3 text-sm font-bold">Producto sin imagen</p>
              <p className="mt-1 text-xs">
                Selecciona una imagen JPG, PNG o WEBP.
              </p>
            </div>
          )}

          {isUploading ? (
            <div className="absolute inset-0 grid place-items-center bg-white/85 backdrop-blur-sm">
              <div className="text-center">
                <LoaderCircle
                  aria-hidden="true"
                  className="mx-auto size-7 animate-spin text-[#173f35]"
                />
                <p className="mt-2 text-sm font-bold text-[#173f35]">
                  Optimizando imagen…
                </p>
                <button
                  type="button"
                  onClick={() => xhrRef.current?.abort()}
                  className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 text-xs font-bold text-stone-600"
                >
                  <X aria-hidden="true" className="size-3.5" />
                  Cancelar subida
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {progress !== null ? (
          <div className="h-1.5 bg-stone-100" aria-label={`Subida ${progress}%`}>
            <div
              className="h-full bg-emerald-500 transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : null}

        <div
          className={`border-t border-stone-200 p-4 transition-colors ${
            isDragging ? "bg-emerald-50" : "bg-white"
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setIsDragging(false);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            handleFileSelection(event.dataTransfer.files);
          }}
        >
          <p className="text-center text-xs text-stone-500">
            Arrastra una imagen aquí o selecciónala desde tu dispositivo.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#173f35] px-4 text-xs font-bold text-white disabled:opacity-50"
            >
              {value ? (
                <RefreshCw aria-hidden="true" className="size-4" />
              ) : (
                <Upload aria-hidden="true" className="size-4" />
              )}
              {value ? "Reemplazar" : "Seleccionar imagen"}
            </button>
            {previewUrl ? (
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled || isUploading}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-bold text-red-700 disabled:opacity-50"
              >
                <Trash2 aria-hidden="true" className="size-4" />
                Eliminar imagen
              </button>
            ) : null}
          </div>
          <p className="mt-3 text-center text-[10px] text-stone-400">
            JPG, JPEG, PNG o WEBP · máximo 10 MB
          </p>
        </div>
      </div>

      <div aria-live="polite" className="mt-2 min-h-5">
        {message ? (
          <p
            role={message.type === "error" ? "alert" : "status"}
            className={`text-xs font-semibold ${
              message.type === "error" ? "text-red-700" : "text-emerald-700"
            }`}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
