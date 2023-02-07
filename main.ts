import { serve } from "https://deno.land/std@0.175.0/http/server.ts";
import {
  ImageMagick,
  initializeImageMagick,
  MagickGeometry,
} from "https://deno.land/x/imagemagick_deno@0.0.14/mod.ts";
import { parseMediaType } from "https://deno.land/std@0.175.0/media_types/parse_media_type.ts";

function parseParams(reqUrl: URL) {
  const image = reqUrl.searchParams.get("image");
  if (image == null) {
    return "Missing 'image' query parameter.";
  }
  const height = Number(reqUrl.searchParams.get("height")) || 0;
  const width = Number(reqUrl.searchParams.get("width")) || 0;
  if (height === 0 && width === 0) {
    return "Missing non-zero 'height' or 'width' query parameter.";
  }
  if (height < 0 || width < 0) {
    return "Negative height or width is not supported.";
  }

  // prevent someone providing too large of a dimension
  const maxDimension = 2048;
  if (height > maxDimension || width > maxDimension) {
    return `Width and height cannot exceed ${maxDimension}.`;
  }

  const acceptedModes = ["resize", "crop"];
  const mode = reqUrl.searchParams.get("mode") || "resize";
  if (!acceptedModes.includes(mode)) {
    return "Mode not accepted: please use 'resize' or 'crop'.";
  }

  return {
    image,
    height,
    width,
    mode,
  };
}

await initializeImageMagick();
serve(
  async (req: Request) => {
    const reqURL = new URL(req.url);
    const params = parseParams(reqURL);
    if (typeof params === "string") {
      return new Response(params, { status: 400 });
    }
    const sourceRes = await fetch(params.image);
    if (!sourceRes.ok) {
      return new Response("Error retrieving image from URL", { status: 400 });
    }
    const mediaType =
      parseMediaType(<string> sourceRes.headers.get("Content-Type"))[0];
    if (mediaType.split("/")[0] !== "image") {
      return new Response("URL is not image type", { status: 400 });
    }
    const sizingData = new MagickGeometry(
      Number(params.width),
      Number(params.height),
    );
    if (params.height && params.width) {
      sizingData.ignoreAspectRatio = true;
    }
    const imageBuffer = new Uint8Array(await sourceRes.arrayBuffer());
    const imageResult: Promise<Uint8Array> = new Promise((resolve) => {
      ImageMagick.read(imageBuffer, function (image) {
        if (params.mode === "resize") {
          image.resize(sizingData);
        } else if (params.mode === "crop") {
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
