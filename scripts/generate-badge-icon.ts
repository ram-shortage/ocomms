/**
 * Generate badge icon for Android push notifications
 *
 * Badge icons should be:
 * - 96x96 pixels
 * - Monochrome (white with transparency)
 * - Simple silhouette
 */
import sharp from "sharp";
import path from "path";

const ICONS_DIR = path.join(process.cwd(), "public/icons");

async function generateBadgeIcon() {
  const inputPath = path.join(ICONS_DIR, "icon-192x192.png");
  const outputPath = path.join(ICONS_DIR, "badge-96x96.png");

  try {
    // Read the source icon and resize to 96x96
    // Extract alpha channel to create monochrome badge
    // For our "O" logo, we'll create a white version on transparent background

    const image = sharp(inputPath);
    const metadata = await image.metadata();

    // Resize to 96x96 and convert to grayscale, then threshold to get clean edges
    // Then use as alpha mask on white background
    await sharp(inputPath)
      .resize(96, 96)
      // Negate to get white "O" (since original is white O on black)
      .negate({ alpha: false })
      // Extract just the letter by removing the black background
      // The original has white O on black, after negate it's black O on white
      // We want white O on transparent
      .toBuffer()
      .then(async (buffer) => {
        // Create the badge: white icon on transparent background
        // We'll use the luminance to create an alpha channel
        const { data, info } = await sharp(buffer)
          .raw()
          .toBuffer({ resolveWithObject: true });

        // Create RGBA buffer where:
        // - RGB is always white (255, 255, 255)
        // - Alpha is based on how dark the pixel is (darker = more opaque)
        const rgba = Buffer.alloc(info.width * info.height * 4);

        for (let i = 0; i < info.width * info.height; i++) {
          const srcIdx = i * info.channels;
          const dstIdx = i * 4;

          // Get luminance (how dark is this pixel after negate)
          // After negate: black O on white background
          // Dark pixels (the O) should be opaque white
          const r = data[srcIdx];
          const g = data[srcIdx + 1];
          const b = data[srcIdx + 2];
          const luminance = (r + g + b) / 3;

          // White color
          rgba[dstIdx] = 255;     // R
          rgba[dstIdx + 1] = 255; // G
          rgba[dstIdx + 2] = 255; // B
          // Alpha: invert luminance (dark pixels become opaque)
          rgba[dstIdx + 3] = 255 - luminance;
        }

        await sharp(rgba, {
          raw: {
            width: info.width,
            height: info.height,
            channels: 4,
          },
        })
          .png()
          .toFile(outputPath);
      });

    console.log(`Badge icon generated: ${outputPath}`);
  } catch (error) {
    console.error("Error generating badge icon:", error);
    process.exit(1);
  }
}

generateBadgeIcon();
