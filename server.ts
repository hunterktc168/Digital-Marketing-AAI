/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import express, { type NextFunction, type Request, type Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import {
  ALLOWED_ASPECT_RATIOS,
  ALLOWED_COUNTRIES,
  ALLOWED_IMAGE_MIME_TYPES,
} from "./shared/constants.js";

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

interface GenerateRequestBody {
  market?: unknown;
  refImage?: unknown;
  mimeType?: unknown;
  ratio?: unknown;
}

async function startServer() {
  const app = express();
  app.set("trust proxy", 2);
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Return JSON errors for malformed or oversized request bodies instead of HTML
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err && typeof err === "object" && "status" in err) {
      const status = Number((err as { status?: number }).status) || 400;
      const message =
        status === 413
          ? "Uploaded image exceeds the maximum allowed payload size."
          : "Invalid JSON request body.";
      res.status(status).json({ error: message });
      return;
    }
    next(err);
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/generate", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as GenerateRequestBody;
      const { market, refImage, mimeType, ratio } = body;

      if (typeof market !== "string" || !ALLOWED_COUNTRIES.has(market)) {
        res.status(400).json({ error: "Invalid or unsupported target market." });
        return;
      }

      if (typeof refImage !== "string" || refImage.length === 0 || !BASE64_PATTERN.test(refImage)) {
        res.status(400).json({ error: "Invalid or missing reference image data." });
        return;
      }

      const resolvedMimeType =
        typeof mimeType === "string" && ALLOWED_IMAGE_MIME_TYPES.has(mimeType)
          ? mimeType
          : "image/jpeg";

      if (mimeType !== undefined && (typeof mimeType !== "string" || !ALLOWED_IMAGE_MIME_TYPES.has(mimeType))) {
        res.status(400).json({ error: "Unsupported image format. Please upload JPEG, PNG, or WebP." });
        return;
      }

      const resolvedRatio =
        typeof ratio === "string" && ALLOWED_ASPECT_RATIOS.has(ratio) ? ratio : "16:9";

      if (ratio !== undefined && (typeof ratio !== "string" || !ALLOWED_ASPECT_RATIOS.has(ratio))) {
        res.status(400).json({ error: "Unsupported aspect ratio." });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        res.status(503).json({
          error: "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
      const model = "gemini-3.1-flash-image-preview";
      const contents = [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: resolvedMimeType,
                data: refImage,
              },
            },
            {
              text: `Translate all text in this advertisement image to the language of ${market}. ONLY translate the text - do not add any cultural imagery, flags, national symbols, or stereotypical visual elements. Keep the image, composition, styling, colors, and all visual elements exactly the same as the original. The only change should be the language of the text.`,
            },
          ],
        },
      ];

      const response = await ai.models.generateContentStream({
        model,
        config: {
          responseModalities: ["IMAGE", "TEXT"],
          imageConfig: {
            aspectRatio: resolvedRatio,
          },
        },
        contents,
      });

      let base64Image: string | null = null;
      let outputMimeType = "image/png";

      for await (const chunk of response) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) {
          continue;
        }
        for (const part of parts) {
          if (part.inlineData?.data) {
            base64Image = part.inlineData.data;
            outputMimeType = part.inlineData.mimeType || "image/png";
            break;
          }
        }
        if (base64Image) break;
      }

      if (!base64Image) {
        res.status(502).json({ error: "No image was returned by the model." });
        return;
      }

      res.json({ base64Image, mimeType: outputMimeType });
    } catch (error: unknown) {
      console.error("[Backend] Error generating localized ad:", error);
      const statusCode =
        error && typeof error === "object" && "status" in error
          ? Number((error as { status?: number }).status)
          : 500;
      const safeStatus = statusCode >= 400 && statusCode < 600 ? statusCode : 500;

      let clientMessage = "Failed to generate localized image. Please try again.";
      if (safeStatus === 400 || safeStatus === 403) {
        clientMessage = "API key rejected or invalid request. Please check GEMINI_API_KEY in Settings > Secrets.";
      } else if (safeStatus === 404) {
        clientMessage = "Configured image model is unavailable or unsupported.";
      } else if (safeStatus === 429) {
        clientMessage = "Rate limit or quota exceeded. Please wait and try again or check billing tier.";
      }

      res.status(safeStatus).json({ error: clientMessage });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(["/server.cjs", "/server.cjs.map"], (_req: Request, res: Response) => {
      res.status(404).end();
    });
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Backend] Server running on http://localhost:${PORT}`);
  });
}

startServer();
