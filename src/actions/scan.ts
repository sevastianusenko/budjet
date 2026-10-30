"use server";

import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireViewerForAction } from "@/lib/auth";
import { errorMessage } from "@/lib/guards";
import { scanSystemPrompt } from "@/lib/receipt-prompt";

export type ScanResult = { ok: true; text: string } | { ok: false; error: string };

const MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MODEL = process.env.HEARTH_AI_MODEL || "claude-opus-5-5";

/** True when the server has an Anthropic API key, so the "Scan receipt" button can show. */
export async function scanAvailable(): Promise<boolean> {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Reads a receipt photo with Claude and returns JSON text in the app's import format.
 * The image arrives as base64 (resized on the phone to keep it under ~1 MB).
 */
export async function scanReceipt(raw: { data: string; mediaType: string }): Promise<ScanResult> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return { ok: false, error: "Receipt scanning isn't set up yet: add ANTHROPIC_API_KEY to the server (Vercel → Settings → Environment Variables)." };
    }
    const mediaType = raw.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    if (!MEDIA.has(mediaType)) return { ok: false, error: "Use a JPEG, PNG or WebP photo." };
    if (!raw.data || raw.data.length > 4_000_000) return { ok: false, error: "That image is too large. Try a smaller photo." };

    const viewer = await requireViewerForAction();
    const db = await getDb();
    const [categories, subs] = await Promise.all([
      db.query.categories.findMany({ where: eq(schema.categories.householdId, viewer.household.id) }),
      db.query.subcategories.findMany({ where: eq(schema.subcategories.householdId, viewer.household.id) }),
    ]);

    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      output_config: { effort: "medium" },
      system: scanSystemPrompt(categories, subs, viewer.today),
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: raw.data } },
            { type: "text", text: "Sort this receipt into my categories and reply with the JSON." },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") return { ok: false, error: "The model declined to read this image. Try another photo or paste the text instead." };
    if (response.stop_reason === "max_tokens") return { ok: false, error: "The receipt was too long to read in one go. Try a tighter photo." };

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .replace(/^```(?:json)?\s*|\s*```$/g, "")
      .trim();
    if (!text) return { ok: false, error: "No text came back from the scan. Try again." };
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed && typeof parsed === "object" && typeof parsed.error === "string") return { ok: false, error: parsed.error };
    } catch {
      /* the import parser is tolerant; let it try */
    }
    return { ok: true, text };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, error: "The server's ANTHROPIC_API_KEY was rejected. Check it in Vercel." };
    if (err instanceof Anthropic.RateLimitError) return { ok: false, error: "Rate limited by the AI service. Wait a minute and try again." };
    if (err instanceof Anthropic.APIError) return { ok: false, error: `AI service error ${err.status}: ${err.message}` };
    return { ok: false, error: errorMessage(err) };
  }
}
