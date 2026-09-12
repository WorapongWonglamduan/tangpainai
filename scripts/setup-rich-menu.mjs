// One-off setup script — creates the bot's default rich menu (ดูสรุป /
// วิธีใช้งาน) and uploads its image. Run manually whenever the menu
// image or actions change; this is not part of the request-serving app.
//
// Usage:
//   node scripts/setup-rich-menu.mjs
//
// Requires LINE_CHANNEL_ACCESS_TOKEN and NEXT_PUBLIC_LIFF_ID in the
// environment (e.g. `node --env-file=.env.local scripts/setup-rich-menu.mjs`).

import { readFile } from "node:fs/promises";
import { messagingApi } from "@line/bot-sdk";

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

if (!channelAccessToken) {
  console.error("LINE_CHANNEL_ACCESS_TOKEN is not set.");
  process.exit(1);
}
if (!liffId) {
  console.error("NEXT_PUBLIC_LIFF_ID is not set — needed for the ดูสรุป tile's link.");
  process.exit(1);
}

const client = new messagingApi.MessagingApiClient({ channelAccessToken });
const blobClient = new messagingApi.MessagingApiBlobClient({ channelAccessToken });

const IMAGE_PATH = new URL("../public/rich-menu/main-menu.png", import.meta.url);
const WIDTH = 2500;
const HEIGHT = 843;
const TILE_WIDTH = WIDTH / 2;

async function main() {
  const richMenu = await client.createRichMenu({
    size: { width: WIDTH, height: HEIGHT },
    selected: true,
    name: "tangpainai-main-menu",
    chatBarText: "เมนู",
    areas: [
      {
        bounds: { x: 0, y: 0, width: TILE_WIDTH, height: HEIGHT },
        action: { type: "uri", uri: `https://liff.line.me/${liffId}` },
      },
      {
        bounds: { x: TILE_WIDTH, y: 0, width: WIDTH - TILE_WIDTH, height: HEIGHT },
        action: { type: "postback", data: "richmenu:usage_guide", displayText: "วิธีใช้งาน" },
      },
    ],
  });

  console.log("Created rich menu:", richMenu.richMenuId);

  const imageBytes = await readFile(IMAGE_PATH);
  const imageBlob = new Blob([imageBytes], { type: "image/png" });
  await blobClient.setRichMenuImage(richMenu.richMenuId, imageBlob);
  console.log("Uploaded image.");

  await client.setDefaultRichMenu(richMenu.richMenuId);
  console.log("Set as the default rich menu for all users.");

  console.log("\nDone. richMenuId:", richMenu.richMenuId);
  console.log("Save this id if you need to delete/replace the menu later via the API.");
}

main().catch((error) => {
  console.error("Failed to set up rich menu:", error);
  process.exit(1);
});
