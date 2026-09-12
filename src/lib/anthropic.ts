import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ExpenseExtractionSchema, ITEMS_INSTRUCTIONS_TH, type ExpenseExtraction } from "@/lib/expense-extraction-schema";

const client = new Anthropic();

export type { ExpenseItem, ExpenseExtraction } from "@/lib/expense-extraction-schema";

const SYSTEM_PROMPT = `คุณทำหน้าที่แยกข้อมูลค่าใช้จ่ายจากข้อความแชทภาษาไทยของผู้ใช้ในบ้าน/ห้องเดียวกัน
${ITEMS_INSTRUCTIONS_TH}
- ถ้าข้อความไม่ได้พูดถึงค่าใช้จ่ายเลย (เช่น ทักทาย, ถามคำถามทั่วไป) ให้ส่ง items เป็น array ว่าง []`;

const SLIP_SYSTEM_PROMPT = `คุณทำหน้าที่อ่านรูปสลิปโอนเงิน/ใบเสร็จ/บิลค่าใช้จ่ายภาษาไทย แล้วแยกข้อมูลค่าใช้จ่าย
${ITEMS_INSTRUCTIONS_TH}
- ถ้ารูปที่ส่งมาไม่ใช่สลิป/ใบเสร็จ/บิลค่าใช้จ่ายเลย หรืออ่านยอดเงินไม่ออกเลย ให้ส่ง items เป็น array ว่าง []`;

async function runExtraction(
  systemPrompt: string,
  content: Anthropic.MessageParam["content"],
): Promise<ExpenseExtraction> {
  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content }],
    output_config: {
      format: zodOutputFormat(ExpenseExtractionSchema),
    },
  });

  return response.parsed_output ?? { items: [] };
}

export async function extractExpenseFromText(text: string): Promise<ExpenseExtraction> {
  return runExtraction(SYSTEM_PROMPT, text);
}

export async function extractExpenseFromImage(
  base64Data: string,
  mediaType: "image/jpeg" | "image/png",
): Promise<ExpenseExtraction> {
  return runExtraction(SLIP_SYSTEM_PROMPT, [
    { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
    { type: "text", text: "อ่านรูปนี้แล้วแยกข้อมูลค่าใช้จ่ายทุกรายการที่พบ" },
  ]);
}
