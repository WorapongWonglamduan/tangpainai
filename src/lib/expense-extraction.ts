import { APIError } from "@anthropic-ai/sdk";
import { extractExpenseFromImage, extractExpenseFromText } from "@/lib/anthropic";
import {
  extractExpenseFromImageViaGemini,
  extractExpenseFromTextViaGemini,
  GeminiNotConfiguredError,
} from "@/lib/gemini";
import { lineClient } from "@/lib/line-client";
import type { ExpenseExtraction } from "@/lib/expense-extraction-schema";

// Anthropic represents an exhausted/invalid billing balance two ways (see
// https://docs.anthropic.com/en/api/errors):
// - 402 with error.type "billing_error" — the documented, machine-readable
//   form for billing/payment issues.
// - 400 with error.type "invalid_request_error" and a "credit balance is too
//   low" message — an older pattern some accounts/keys still hit (see
//   https://github.com/anthropics/anthropic-sdk-python/issues/1646).
// Both are distinct from RateLimitError (429, transient, retry-worthy) and
// from other 400s (a real bug in our request), which must NOT fall back.
const CREDIT_BALANCE_MESSAGE_FRAGMENT = "credit balance is too low";

function isCreditBalanceExhausted(error: unknown): boolean {
  if (!(error instanceof APIError)) return false;
  if (error.status === 402 && error.type === "billing_error") return true;
  return (
    error.status === 400 &&
    error.type === "invalid_request_error" &&
    error.message.toLowerCase().includes(CREDIT_BALANCE_MESSAGE_FRAGMENT)
  );
}

// Once we've seen a credit-exhausted response, avoid re-trying Anthropic
// (and paying its request latency) for every message in this server process
// until the next deploy/restart re-checks it. This is intentionally
// process-local, not persisted — a redeploy after topping up credits clears
// it, and multiple instances degrade independently rather than sharing state
// that could get stuck stale.
let anthropicCreditExhausted = false;

type NotifyContext = {
  lineTo: string;
};

async function notifyFallbackActivated(context: NotifyContext): Promise<void> {
  const text =
    "⚠️ ระบบสลับไปใช้ AI สำรอง (Gemini) ชั่วคราว เพราะเครดิต Claude หมด\n" +
    "การจัดหมวดอาจแม่นยำน้อยลงกว่าปกติ และข้อมูลที่ส่งไปจะถูกประมวลผลโดย Google แทน Anthropic\n" +
    "กรุณาเติมเครดิตที่ console.anthropic.com เพื่อสลับกลับ";

  await Promise.allSettled([
    lineClient.pushMessage({ to: context.lineTo, messages: [{ type: "text", text }] }),
    notifyDiscord(text),
  ]);
}

async function notifyDiscord(text: string): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `[tangpainai] ${text}` }),
    });
  } catch (error) {
    console.error("Failed to notify Discord about AI provider fallback", error);
  }
}

type ExtractionMode =
  | { type: "text"; text: string }
  | { type: "image"; base64Data: string; mediaType: "image/jpeg" | "image/png" };

async function runWithFallback(mode: ExtractionMode, lineTo: string): Promise<ExpenseExtraction> {
  if (!anthropicCreditExhausted) {
    try {
      return mode.type === "text"
        ? await extractExpenseFromText(mode.text)
        : await extractExpenseFromImage(mode.base64Data, mode.mediaType);
    } catch (error) {
      if (!isCreditBalanceExhausted(error)) {
        throw error;
      }

      console.error("Anthropic credit balance exhausted — switching to Gemini fallback", error);
      anthropicCreditExhausted = true;
      await notifyFallbackActivated({ lineTo });
    }
  }

  try {
    return mode.type === "text"
      ? await extractExpenseFromTextViaGemini(mode.text)
      : await extractExpenseFromImageViaGemini(mode.base64Data, mode.mediaType);
  } catch (error) {
    if (error instanceof GeminiNotConfiguredError) {
      console.error("Anthropic is exhausted and no Gemini fallback is configured", error);
      return { items: [] };
    }
    throw error;
  }
}

// `lineTo` is the household's LINE user/group ID — the same identity used to
// receive the confirm prompt, so the fallback notice reaches the household
// that's actually affected, not a global admin channel.
export async function extractExpenseFromTextWithFallback(
  text: string,
  lineTo: string,
): Promise<ExpenseExtraction> {
  return runWithFallback({ type: "text", text }, lineTo);
}

export async function extractExpenseFromImageWithFallback(
  base64Data: string,
  mediaType: "image/jpeg" | "image/png",
  lineTo: string,
): Promise<ExpenseExtraction> {
  return runWithFallback({ type: "image", base64Data, mediaType }, lineTo);
}
