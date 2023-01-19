import { serve } from "https://deno.land/std@0.173.0/http/server.ts";
import {
  ImageMagick,
  initializeImageMagick,
  MagickGeometry,
} from "https://deno.land/x/imagemagick_deno/mod.ts";

await initializeImageMagick();
serve(
  async (req: Request) => {
    const reqURL = new URL(req.url);
    if (
      !reqURL.searchParams.has("image") ||
      (!reqURL.searchParams.has("height") && !reqURL.searchParams.has("width"))
    ) {
      return new Response("Not enough data provided", {
        status: 400,
      });
    }
    const sourceReq = await fetch(reqURL.searchParams.get("image") as string);
    const imageType = (<string> sourceReq.headers.get("Content-Type")).split(
      "/",
    )[1];
    const imageBuffer = new Uint8Array(await sourceReq.arrayBuffer());
    const mode = reqURL.searchParams.get("mode") || "resize";
    const sizingData = new MagickGeometry(
      Number(reqURL.searchParams.get("width")) || 0,
      Number(reqURL.searchParams.get("height")) || 0,
    );
    sizingData.height = Number(reqURL.searchParams.get("height")) || 0;
    if (reqURL.searchParams.get("height") && reqURL.searchParams.get("width")) {
      sizingData.ignoreAspectRatio = true;
    }
    const imageResult: Promise<Uint8Array> = new Promise((resolve) => {
      ImageMagick.read(imageBuffer, function (image) {
        if (mode === "resize") {
          image.resize(sizingData);
        } else if (mode === "crop") {
          image.crop(sizingData);
        } else {
          return new Response("Invalid mode", {
            status: 400,
          });
        }
        image.write(function (data) {
          resolve(data);
        });
      });
    });
    return new Response(await imageResult, {
      headers: {
        "Content-Type": `image/${imageType}`,
      },
    });
  },
  { port: 8080 },
);
