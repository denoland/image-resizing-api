import { serve } from "https://deno.land/std@0.175.0/http/server.ts";
import {
  ImageMagick,
  initializeImageMagick,
  MagickGeometry,
} from "https://deno.land/x/imagemagick_deno@0.0.14/mod.ts";
import { parseMediaType } from "https://deno.land/std@0.175.0/media_types/parse_media_type.ts";

const ACCEPTED_MODES = ["resize", "crop"];

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
    const sourceRes = await fetch(reqURL.searchParams.get("image") as string);
    if (!sourceRes.ok) {
      return new Response("Error retrieving image from URL", { status: 400 });
    }

    const mediaType =
      parseMediaType(<string> sourceRes.headers.get("Content-Type"))[0];
    if (mediaType.split("/")[0] !== "image") {
      return new Response("URL is not image type", { status: 400 });
    }

    const imageBuffer = new Uint8Array(await sourceRes.arrayBuffer());
    const mode = reqURL.searchParams.get("mode") || "resize";
    if (!ACCEPTED_MODES.includes(mode)) {
      return new Response("Mode not accepted: please use 'resize' or 'crop'.", {
        status: 400,
      });
    }
    const sizingData = new MagickGeometry(
      Number(reqURL.searchParams.get("width")) || 0,
      Number(reqURL.searchParams.get("height")) || 0,
    );
    if (reqURL.searchParams.get("height") && reqURL.searchParams.get("width")) {
      sizingData.ignoreAspectRatio = true;
    }
    const imageResult: Promise<Uint8Array> = new Promise((resolve) => {
      ImageMagick.read(imageBuffer, function (image) {
        if (mode === "resize") {
          image.resize(sizingData);
        } else if (mode === "crop") {
          image.crop(sizingData);
        }
        image.write(function (data) {
          resolve(data);
        });
      });
    });
    return new Response(await imageResult, {
      headers: {
        "Content-Type": mediaType,
      },
    });
  },
  { port: 8080 },
);
