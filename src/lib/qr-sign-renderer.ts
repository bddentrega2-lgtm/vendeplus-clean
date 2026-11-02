export type QrSignPlace =
  | { type: "mesa"; tableNumber: number }
  | { type: "barra" };

export type QrSignRenderOptions = {
  logoUrl: string;
  qrDataUrl: string;
  place: QrSignPlace;
};

const WIDTH = 1200;
const HEIGHT = 1800;
const PX_PER_MM = WIDTH / 100;
const CSS_PX_SCALE = WIDTH / (100 * (96 / 25.4));
const FONT_FAMILY = "SomosQrOutfit";
const COLORS = {
  cream: "#FFFCF4",
  orange: "#FF6B25",
  green: "#073D40",
  white: "#FFFFFF",
};

let fontsPromise: Promise<void> | null = null;

export function parseQrSignTableNumber(value: string) {
  const trimmed = value.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const number = Number(trimmed);
  return number >= 1 && number <= 999 ? number : null;
}

export function formatQrSignTableNumber(value: number) {
  return value < 10 ? String(value).padStart(2, "0") : String(value);
}

function mm(value: number) {
  return value * PX_PER_MM;
}

async function loadFonts() {
  if (fontsPromise) return fontsPromise;
  fontsPromise = (async () => {
    if (document.fonts.check(`700 16px ${FONT_FAMILY}`) && document.fonts.check(`400 16px ${FONT_FAMILY}`)) return;
    const [regular, bold] = await Promise.all([
      new FontFace(FONT_FAMILY, "url(/qr-sign/Outfit-Regular.ttf)", { weight: "400" }).load(),
      new FontFace(FONT_FAMILY, "url(/qr-sign/Outfit-Bold.ttf)", { weight: "700" }).load(),
    ]);
    document.fonts.add(regular);
    document.fonts.add(bold);
    await document.fonts.ready;
  })().catch((error) => {
    fontsPromise = null;
    throw error;
  });
  return fontsPromise;
}

function loadImage(source: string, label: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => image.naturalWidth > 0
      ? resolve(image)
      : reject(new Error(`No se pudo cargar ${label}.`));
    image.onerror = () => reject(new Error(`No se pudo cargar ${label}.`));
    image.src = source;
  });
}

function drawRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) {
  context.fillStyle = color;
  context.fillRect(mm(x), mm(y), mm(width), mm(height));
}

function drawText(
  context: CanvasRenderingContext2D,
  text: string,
  box: [number, number, number, number],
  size: number,
  weight: 400 | 700,
  color: string,
) {
  const [x, y, width, height] = box;
  context.save();
  context.font = `${weight} ${size * CSS_PX_SCALE}px ${FONT_FAMILY}`;
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, mm(x + width / 2), mm(y + height / 2));
  context.restore();
}

function drawContainedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  box: [number, number, number, number],
  smooth = true,
) {
  const [x, y, width, height] = box.map(mm) as [number, number, number, number];
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const renderedWidth = image.naturalWidth * scale;
  const renderedHeight = image.naturalHeight * scale;
  context.save();
  context.imageSmoothingEnabled = smooth;
  if (smooth) context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    x + (width - renderedWidth) / 2,
    y + (height - renderedHeight) / 2,
    renderedWidth,
    renderedHeight,
  );
  context.restore();
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  box: [number, number, number, number],
) {
  const [x, y, width, height] = box.map(mm) as [number, number, number, number];
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const renderedWidth = image.naturalWidth * scale;
  const renderedHeight = image.naturalHeight * scale;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    x + (width - renderedWidth) / 2,
    y + (height - renderedHeight) / 2,
    renderedWidth,
    renderedHeight,
  );
}

function drawCircularLogo(context: CanvasRenderingContext2D, image: HTMLImageElement) {
  const box: [number, number, number, number] = [33, 14, 34, 34];
  const [x, y, width, height] = box.map(mm) as [number, number, number, number];
  const radius = Math.min(width, height) / 2;

  context.save();
  context.beginPath();
  context.arc(x + width / 2, y + height / 2, radius, 0, Math.PI * 2);
  context.fillStyle = COLORS.white;
  context.fill();
  context.clip();
  drawCoverImage(context, image, box);
  context.restore();

  context.save();
  context.beginPath();
  context.arc(x + width / 2, y + height / 2, radius, 0, Math.PI * 2);
  context.strokeStyle = COLORS.green;
  context.lineWidth = mm(0.45);
  context.stroke();
  context.restore();
}

export async function renderQrSign(canvas: HTMLCanvasElement, options: QrSignRenderOptions) {
  if (!options.logoUrl) throw new Error("Este comercio todavía no tiene un logo configurado.");
  if (!options.qrDataUrl) throw new Error("El QR todavía no está disponible.");

  const [logo, qr, somos] = await Promise.all([
    loadImage(options.logoUrl, "el logo del comercio"),
    loadImage(options.qrDataUrl, "el QR"),
    loadImage("/qr-sign/somos.png", "el logo de SOMOS"),
    loadFonts(),
  ]);

  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("No se pudo preparar la imagen.");

  context.setTransform(1, 0, 0, 1, 0, 0);
  drawRect(context, 0, 0, 100, 150, COLORS.cream);
  drawRect(context, 0, 0, 100, 12, COLORS.orange);
  drawText(context, "Pide sin hacer colas", [0, 0, 100, 12], 19, 700, COLORS.white);
  drawCircularLogo(context, logo);

  if (options.place.type === "mesa") {
    const label = formatQrSignTableNumber(options.place.tableNumber);
    drawText(context, "MESA", [25, 53, 32, 15], 32, 700, COLORS.green);
    drawText(context, label, [54, 51, 21, 18], label.length === 3 ? 42 : 52, 700, COLORS.green);
    drawRect(context, 45, 69, 10, 0.7, COLORS.orange);
    drawText(context, "Escanea y haz tu pedido", [5, 71, 90, 7], 18, 700, COLORS.green);
    drawRect(context, 23, 79, 54, 52, COLORS.white);
    drawContainedImage(context, qr, [24, 79, 52, 52], false);
  } else {
    drawRect(context, 45, 57.5, 10, 0.7, COLORS.orange);
    drawText(context, "Escanea y haz tu pedido", [5, 59.5, 90, 7], 18, 700, COLORS.green);
    drawRect(context, 19.75, 69.2, 60.5, 58.3, COLORS.white);
    drawContainedImage(context, qr, [19.75, 69.2, 60.5, 58.3], false);
  }

  drawContainedImage(context, somos, [34, 132.5, 32, 6.4]);
  drawRect(context, 0, 142, 100, 8, COLORS.green);
  drawText(context, "www.somos-ve.com", [0, 142, 100, 8], 11, 400, COLORS.white);
}

export function qrSignFilename(slug: string, place: QrSignPlace) {
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "comercio";
  const suffix = place.type === "barra"
    ? "barra"
    : `mesa-${formatQrSignTableNumber(place.tableNumber)}`;
  return `somos-${safeSlug}-${suffix}.png`;
}
