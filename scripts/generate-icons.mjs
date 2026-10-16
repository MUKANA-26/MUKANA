// Generates every brand asset and icon from the master logo.
// Usage: npm run icons   (expects the master logo at public/brand/MUKANA_LOGO.png)
import sharp from "sharp";
import { mkdir, writeFile, copyFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandDir = path.join(root, "public", "brand");
const iconDir = path.join(root, "public", "icons");
const master = path.join(brandDir, "MUKANA_LOGO.png");

await mkdir(brandDir, { recursive: true });
await mkdir(iconDir, { recursive: true });
try {
  await access(master);
} catch {
  await copyFile(path.join(root, "_src", "logo.png"), master);
}

const meta = await sharp(master).metadata();
const scale = meta.width / 1254;
// Bounding box of the two-figure "M" mark inside the 1254px master.
const markBox = {
  left: Math.round(340 * scale),
  top: Math.round(170 * scale),
  width: Math.round(580 * scale),
  height: Math.round(560 * scale),
};

// Lift the faint off-white backdrop of the master to pure white (colours are untouched).
const cleaned = await sharp(master).linear(1.03, 0).flatten({ background: "#ffffff" }).png().toBuffer();
const markSquare = async (size, pad = 0) => {
  const inner = size - pad * 2;
  const mark = await sharp(cleaned)
    .extract(markBox)
    .resize(inner, inner, { fit: "contain", background: "#ffffff" })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 3, background: "#ffffff" } })
    .composite([{ input: mark, left: pad, top: pad }])
    .png()
    .toBuffer();
};

// Full logo cleaned for web use.
await sharp(cleaned).resize(800, 800).png({ compressionLevel: 9 }).toFile(path.join(brandDir, "logo-full.png"));
await sharp(cleaned).resize(1200, 1200).jpeg({ quality: 90 }).toFile(path.join(brandDir, "MUKANA_LOGO.jpeg"));

// Transparent mark (white backdrop converted to alpha) for the header and dark theme.
{
  const { data, info } = await sharp(cleaned)
    .extract(markBox)
    .resize(512, 512, { fit: "contain", background: "#ffffff" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const a = (255 - Math.min(r, g, b)) / 255;
    if (a <= 0.004) {
      data[i + 3] = 0;
      continue;
    }
    data[i] = Math.max(0, Math.min(255, Math.round((r - 255 * (1 - a)) / a)));
    data[i + 1] = Math.max(0, Math.min(255, Math.round((g - 255 * (1 - a)) / a)));
    data[i + 2] = Math.max(0, Math.min(255, Math.round((b - 255 * (1 - a)) / a)));
    data[i + 3] = Math.round(a * 255);
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim()
    .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(brandDir, "mark.png"));
}

// App icons.
await writeFile(path.join(iconDir, "icon-192.png"), await markSquare(192, 14));
await writeFile(path.join(iconDir, "icon-512.png"), await markSquare(512, 36));
// Maskable: mark kept inside the central 80% safe zone, white background.
await writeFile(path.join(iconDir, "maskable-512.png"), await markSquare(512, 92));
await writeFile(path.join(iconDir, "apple-touch-icon.png"), await markSquare(180, 16));

// Favicon: PNG-in-ICO (16/32/48 are all accepted by browsers as one 48px PNG entry set).
const sizes = [32, 48];
const pngs = [];
for (const s of sizes) pngs.push(await markSquare(s, 2));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);
let offset = 6 + pngs.length * 16;
const entries = pngs.map((png, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(sizes[i], 0);
  e.writeUInt8(sizes[i], 1);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(png.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += png.length;
  return e;
});
await writeFile(path.join(root, "src", "app", "favicon.ico"), Buffer.concat([header, ...entries, ...pngs]));
await writeFile(path.join(iconDir, "favicon-32.png"), pngs[0]);

console.log("Brand assets and icons generated.");
