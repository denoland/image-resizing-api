import { serve } from "https://deno.land/std@0.175.0/http/server.ts";
import {
  ImageMagick,
  initializeImageMagick,
  MagickGeometry,
} from "https://deno.land/x/imagemagick_deno@0.0.14/mod.ts";
import { parseMediaType } from "https://deno.land/std@0.175.0/media_types/parse_media_type.ts";

await initializeImageMagick();

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

async function getRemoteImage(image: string) {
  const sourceRes = await fetch(image);
  if (!sourceRes.ok) {
    return "Error retrieving image from URL.";
  }
  const mediaType = parseMediaType(sourceRes.headers.get("Content-Type")!)[0];
  if (mediaType.split("/")[0] !== "image") {
    return "URL is not image type.";
  }
  return {
    buffer: new Uint8Array(await sourceRes.arrayBuffer()),
    mediaType,
  };
}

function modifyImage(
  imageBuffer: Uint8Array,
  params: { width: number; height: number; mode: string },
) {
  const sizingData = new MagickGeometry(
    params.width,
    params.height,
  );
  sizingData.ignoreAspectRatio = params.height > 0 && params.width > 0;
  return new Promise<Uint8Array>((resolve) => {
    ImageMagick.read(imageBuffer, (image) => {
      if (params.mode === "resize") {
        image.resize(sizingData);
      } else {
        image.crop(sizingData);
      }
      image.write((data) => resolve(data));
    });
  });
}

serve(
  async (req: Request) => {
    const reqURL = new URL(req.url);
    const params = parseParams(reqURL);
    if (typeof params === "string") {
      return new Response(params, { status: 400 });
    }
    const remoteImage = await getRemoteImage(params.image);
    if (remoteImage === "string") {
      return new Response(remoteImage, { status: 400 });
    }
    const modifiedImage = await modifyImage(remoteImage.buffer, params);
    return new Response(modifiedImage, {
      headers: {
        "Content-Type": remoteImage.mediaType,
      },
    });
  },
);
