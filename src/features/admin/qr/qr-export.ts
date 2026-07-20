import QRCode from "qrcode";

import type {
  QrDownloadFormat,
  QrDownloadSize,
} from "./qr-url";

export type QrExportOptions = {
  url: string;
  size: QrDownloadSize;
  restaurantName: string;
  callToAction: string;
  showRestaurantName: boolean;
  showCallToAction: boolean;
};

const qrOptions = {
  errorCorrectionLevel: "H" as const,
  margin: 4,
  color: {
    dark: "#111111",
    light: "#ffffff",
  },
};

function getTextLayout(options: QrExportOptions) {
  const lines = [
    options.showRestaurantName ? options.restaurantName : null,
    options.showCallToAction ? options.callToAction : null,
  ].filter((line): line is string => Boolean(line));
  const fontSize = Math.max(18, Math.round(options.size * 0.045));
  const lineHeight = Math.round(fontSize * 1.4);
  const padding = lines.length > 0 ? Math.round(options.size * 0.05) : 0;

  return {
    lines,
    fontSize,
    lineHeight,
    textHeight: lines.length * lineHeight + padding * 2,
    padding,
  };
}

export function generateQrPreviewDataUrl(url: string) {
  return QRCode.toDataURL(url, {
    ...qrOptions,
    width: 512,
    type: "image/png",
  });
}

export async function createQrPngBlob(options: QrExportOptions) {
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, options.url, {
    ...qrOptions,
    width: options.size,
  });
  const textLayout = getTextLayout(options);
  const output = document.createElement("canvas");
  output.width = options.size;
  output.height = options.size + textLayout.textHeight;
  const context = output.getContext("2d");

  if (!context) {
    throw new Error("Canvas no disponible.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, output.width, output.height);
  context.drawImage(qrCanvas, 0, 0);
  context.fillStyle = "#173f35";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `600 ${textLayout.fontSize}px Georgia, serif`;

  textLayout.lines.forEach((line, index) => {
    context.fillText(
      line,
      output.width / 2,
      options.size +
        textLayout.padding +
        textLayout.lineHeight * index +
        textLayout.lineHeight / 2,
      output.width * 0.9,
    );
  });

  return new Promise<Blob>((resolve, reject) => {
    output.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("No se pudo crear el PNG.")),
      "image/png",
    );
  });
}

export async function createQrSvgBlob(options: QrExportOptions) {
  const qrSvgText = await QRCode.toString(options.url, {
    ...qrOptions,
    type: "svg",
    width: options.size,
  });
  const parser = new DOMParser();
  const sourceDocument = parser.parseFromString(qrSvgText, "image/svg+xml");
  const sourceSvg = sourceDocument.documentElement;

  if (sourceSvg.nodeName.toLowerCase() !== "svg") {
    throw new Error("El SVG generado no es válido.");
  }

  const textLayout = getTextLayout(options);
  const namespace = "http://www.w3.org/2000/svg";
  const output = document.createElementNS(namespace, "svg");
  const outputHeight = options.size + textLayout.textHeight;
  output.setAttribute("xmlns", namespace);
  output.setAttribute("width", String(options.size));
  output.setAttribute("height", String(outputHeight));
  output.setAttribute("viewBox", `0 0 ${options.size} ${outputHeight}`);
  output.setAttribute("role", "img");
  output.setAttribute("aria-label", `Código QR para ${options.url}`);

  const background = document.createElementNS(namespace, "rect");
  background.setAttribute("width", "100%");
  background.setAttribute("height", "100%");
  background.setAttribute("fill", "#ffffff");
  output.appendChild(background);

  const nestedQr = document.importNode(sourceSvg, true);
  nestedQr.setAttribute("x", "0");
  nestedQr.setAttribute("y", "0");
  nestedQr.setAttribute("width", String(options.size));
  nestedQr.setAttribute("height", String(options.size));
  output.appendChild(nestedQr);

  textLayout.lines.forEach((line, index) => {
    const text = document.createElementNS(namespace, "text");
    text.setAttribute("x", String(options.size / 2));
    text.setAttribute(
      "y",
      String(
        options.size +
          textLayout.padding +
          textLayout.lineHeight * index +
          textLayout.lineHeight / 2,
      ),
    );
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("font-family", "Georgia, serif");
    text.setAttribute("font-size", String(textLayout.fontSize));
    text.setAttribute("font-weight", "600");
    text.setAttribute("fill", "#173f35");
    text.textContent = line;
    output.appendChild(text);
  });

  const serialized = new XMLSerializer().serializeToString(output);
  return new Blob([serialized], {
    type: "image/svg+xml;charset=utf-8",
  });
}

export function downloadQrBlob(
  blob: Blob,
  filename: string,
  format: QrDownloadFormat,
) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.type = format === "png" ? "image/png" : "image/svg+xml";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
