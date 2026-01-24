/**
 * Generate placeholder PWA screenshots
 *
 * These are simple placeholders showing the app name.
 * Replace with real screenshots for better install experience.
 */
import sharp from "sharp";
import path from "path";

const SCREENSHOTS_DIR = path.join(process.cwd(), "public/screenshots");

async function createScreenshot(
  width: number,
  height: number,
  filename: string,
  label: string
) {
  // Create a dark background with centered text
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#0a0a0a"/>
      <text
        x="50%"
        y="45%"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="${Math.min(width, height) * 0.15}"
        font-weight="bold"
        fill="white"
        text-anchor="middle"
        dominant-baseline="middle"
      >OComms</text>
      <text
        x="50%"
        y="58%"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="${Math.min(width, height) * 0.04}"
        fill="#888"
        text-anchor="middle"
        dominant-baseline="middle"
      >${label}</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(SCREENSHOTS_DIR, filename));

  console.log(`Created: ${filename} (${width}x${height})`);
}

async function main() {
  // Desktop screenshot (wide)
  await createScreenshot(1280, 720, "desktop-chat.png", "Secure team communication");

  // Mobile screenshot (narrow)
  await createScreenshot(390, 844, "mobile-chat.png", "Secure team communication");

  console.log("\nScreenshots created in public/screenshots/");
  console.log("Replace these with real app screenshots for better install UX.");
}

main().catch(console.error);
