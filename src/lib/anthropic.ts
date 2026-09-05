import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { EXPENSE_CATEGORY, type ExpenseCategoryValue } from "@/constants/expense-category";

const client = new Anthropic();

const categoryValues = Object.values(EXPENSE_CATEGORY) as [
  ExpenseCategoryValue,
  ...ExpenseCategoryValue[],
];

const ExpenseItemSchema = z.object({
  category: z.enum(categoryValues),
  amount: z.number(),
  note: z.string().nullable(),
});

const ExpenseExtractionSchema = z.object({
  items: z.array(ExpenseItemSchema),
});

export type ExpenseItem = z.infer<typeof ExpenseItemSchema>;
export type ExpenseExtraction = z.infer<typeof ExpenseExtractionSchema>;

const CATEGORY_DESCRIPTIONS_TH = `RENT (ค่าที่พัก/ค่าเช่า), UTILITIES (ค่าน้ำ ค่าไฟ), INTERNET (ค่าอินเทอร์เน็ต/ไวไฟ/มือถือรายเดือน), AI (ค่าใช้จ่ายเกี่ยวกับ AI เช่น ค่าสมัคร Claude, ChatGPT, ค่า API ของผู้ให้บริการ AI), FOOD (ค่าอาหาร ค่ากิน), OTHER (อื่นๆ ที่ไม่เข้าพวก)`;

const ITEMS_INSTRUCTIONS_TH = `- ส่งกลับเป็น items ซึ่งเป็น array ของรายการค่าใช้จ่ายที่พบทั้งหมด อาจมีมากกว่า 1 รายการถ้ามีหลายหมวดปนกันในข้อความ/สลิปเดียว (เช่น บิลรวมค่าน้ำ+ค่าไฟ+ค่าห้อง+ค่าเน็ตในใบเดียว ให้แยกเป็นคนละรายการตามหมวดของมัน)
- แต่ละรายการ: category ต้องเป็นหนึ่งใน: ${CATEGORY_DESCRIPTIONS_TH}
- amount คือจำนวนเงินของรายการนั้นเป็นตัวเลข (บาท)
- note ใส่คำอธิบายสั้นๆ ของรายการนั้น (เช่นชื่อรายการในบิล/ชื่อร้าน) ถ้าไม่มีให้ใส่ null`;

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
