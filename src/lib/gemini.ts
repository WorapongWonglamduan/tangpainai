import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { ExpenseExtractionSchema, ITEMS_INSTRUCTIONS_TH, type ExpenseExtraction } from "@/lib/expense-extraction-schema";

const apiKey = process.env.GEMINI_API_KEY;
const client = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Gemini's responseSchema accepts a subset of JSON Schema (OpenAPI-style) —
// generated once from the same Zod schema Anthropic uses, so both providers
// are constrained to identical shapes and category enums.
const responseJsonSchema = z.toJSONSchema(ExpenseExtractionSchema, { target: "draft-7" });

const SYSTEM_PROMPT = `คุณทำหน้าที่แยกข้อมูลค่าใช้จ่ายจากข้อความแชทภาษาไทยของผู้ใช้ในบ้าน/ห้องเดียวกัน
${ITEMS_INSTRUCTIONS_TH}
- ถ้าข้อความไม่ได้พูดถึงค่าใช้จ่ายเลย (เช่น ทักทาย, ถามคำถามทั่วไป) ให้ส่ง items เป็น array ว่าง []`;

const SLIP_SYSTEM_PROMPT = `คุณทำหน้าที่อ่านรูปสลิปโอนเงิน/ใบเสร็จ/บิลค่าใช้จ่ายภาษาไทย แล้วแยกข้อมูลค่าใช้จ่าย
${ITEMS_INSTRUCTIONS_TH}
- ถ้ารูปที่ส่งมาไม่ใช่สลิป/ใบเสร็จ/บิลค่าใช้จ่ายเลย หรืออ่านยอดเงินไม่ออกเลย ให้ส่ง items เป็น array ว่าง []`;

// Thrown when GEMINI_API_KEY isn't configured — distinct from a Gemini API
// call failing, so callers can tell "no fallback available" apart from
// "fallback was tried and it also failed".
export class GeminiNotConfiguredError extends Error {
  constructor() {
    super("GEMINI_API_KEY is not set — cannot use Gemini as a fallback");
  }
}

async function runGeminiExtraction(
  systemInstruction: string,
  parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[],
): Promise<ExpenseExtraction> {
  if (!client) {
    throw new GeminiNotConfiguredError();
  }

  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseJsonSchema,
    },
  });

  const text = response.text;
  if (!text) {
    return { items: [] };
  }

  try {
    return ExpenseExtractionSchema.parse(JSON.parse(text));
  } catch {
    // Malformed/unparsable output is treated the same as "nothing found"
    // rather than surfacing a schema error to the LINE user.
    return { items: [] };
  }
}

export async function extractExpenseFromTextViaGemini(text: string): Promise<ExpenseExtraction> {
  return runGeminiExtraction(SYSTEM_PROMPT, [{ text }]);
}

export async function extractExpenseFromImageViaGemini(
  base64Data: string,
  mediaType: "image/jpeg" | "image/png",
): Promise<ExpenseExtraction> {
  return runGeminiExtraction(SLIP_SYSTEM_PROMPT, [
    { inlineData: { mimeType: mediaType, data: base64Data } },
    { text: "อ่านรูปนี้แล้วแยกข้อมูลค่าใช้จ่ายทุกรายการที่พบ" },
  ]);
}
