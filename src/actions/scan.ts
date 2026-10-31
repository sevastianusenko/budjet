"use server";

import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireViewerForAction } from "@/lib/auth";
import { errorMessage } from "@/lib/guards";
import { scanPrompt } from "@/lib/receipt-prompt";

export type ScanResult = { ok: true; text: string } | { ok: false; error: string };

const MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
/** Haiku reads receipts well and costs about a tenth of a cent per photo; HEARTH_AI_MODEL picks another model. */
const MODEL = process.env.HEARTH_AI_MODEL || "claude-haiku-5-5";

/**
 * Reads a receipt photo with Claude and returns text in the same shape the paste box expects, so the
 * review step is identical for both routes. The image arrives as base64, already shrunk on the phone.
 */
export async function scanReceipt(raw: { data: string; mediaType: string }): Promise<ScanResult> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return { ok: false, error: "Receipt scanning isn't switched on: add ANTHROPIC_API_KEY on the server (Vercel → Settings → Environment Variables)." };
    }
    const mediaType = MEDIA.find((m) => m === raw.mediaType);
    if (!mediaType) return { ok: false, error: "Use a JPEG, PNG or WebP photo." };
    if (!raw.data || raw.data.length > 3_000_000) return { ok: false, error: "That image is too large. Try a smaller photo." };

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
      system: scanPrompt(categories, subs, viewer.today),
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: raw.data } },
            { type: "text", text: "Here is the receipt. Sort it into my categories in the format from your instructions." },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") return { ok: false, error: "Claude declined to read this image. Try another photo, or paste the text instead." };
    if (response.stop_reason === "max_tokens") return { ok: false, error: "The receipt was too long to read in one go. Try a tighter photo, or two photos." };

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .replace(/^```[a-z]*\s*|\s*```$/g, "")
      .trim();
    if (!text) return { ok: false, error: "Nothing came back from the scan. Try again." };
    const notAReceipt = /^error:\s*(.+)/i.exec(text);
    if (notAReceipt) return { ok: false, error: notAReceipt[1].trim() };
    return { ok: true, text };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, error: "The server's ANTHROPIC_API_KEY was rejected. Check it in Vercel." };
    if (err instanceof Anthropic.RateLimitError) return { ok: false, error: "The AI service is rate limiting us. Wait a minute and try again." };
    if (err instanceof Anthropic.APIError) return { ok: false, error: `AI service error ${err.status}: ${err.message}` };
    return { ok: false, error: errorMessage(err) };
  }
}
