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

const CATEGORY_DESCRIPTIONS_TH = `
- RENT: ค่าที่พัก/ค่าเช่า
- UTILITIES: ค่าน้ำ ค่าไฟ
- INTERNET: ค่าอินเทอร์เน็ต/ไวไฟ/มือถือรายเดือน
- SUBSCRIPTION: ค่าสมาชิก/บริการรายเดือนที่หักซ้ำทุกเดือน เช่น ค่าสมัคร Claude, ChatGPT, ค่า API ของผู้ให้บริการ AI, Netflix, Spotify, YouTube Premium (ชื่อผู้รับเงินที่มักเป็นหมวดนี้: Anthropic, OpenAI, Netflix, Spotify)
- FOOD: อาหาร/เครื่องดื่มที่กินตอนนั้นหรือสั่งมากิน เช่น ค่าข้าว ค่ากาแฟ เดลิเวอรี่ ร้านอาหาร
- GROCERIES: ของกิน/ของใช้ที่ซื้อเข้าบ้านไว้ใช้ต่อเนื่อง ไม่ใช่กินทันที เช่น ของเข้าตู้เย็น สบู่ ผงซักฟอก แชมพู กระดาษทิชชู่
- TRANSPORT: ค่าเดินทาง เช่น ค่า Grab/แท็กซี่ ค่าน้ำมัน ค่าทางด่วน ค่าที่จอดรถ
- HOUSEHOLD: ของใช้ในบ้านที่ไม่ใช่ของกิน/ของใช้สิ้นเปลืองประจำวัน เช่น เฟอร์นิเจอร์ เครื่องใช้ไฟฟ้า ค่าเรียกช่างซ่อม อุปกรณ์ทำความสะอาดขนาดใหญ่
- HEALTH: ค่ายา ค่าหมอ ค่าประกันสุขภาพ ค่าตรวจสุขภาพ
- SHOPPING: ของใช้ส่วนตัวที่ไม่เกี่ยวกับของใช้ร่วมกันในบ้าน เช่น เสื้อผ้า เครื่องประดับ ของที่ซื้อผ่าน Shopee/Lazada เพื่อใช้ส่วนตัว
- ENTERTAINMENT: ความบันเทิง/กิจกรรม/ท่องเที่ยว เช่น ดูหนัง คอนเสิร์ต ทริปเที่ยว ค่าเข้าสถานที่ท่องเที่ยว
- OTHER: อื่นๆ ที่ไม่เข้าพวกใดเลยจริงๆ`;

const ITEMS_INSTRUCTIONS_TH = `- ส่งกลับเป็น items ซึ่งเป็น array ของรายการค่าใช้จ่ายที่พบทั้งหมด อาจมีมากกว่า 1 รายการถ้ามีหลายหมวดปนกันในข้อความ/สลิปเดียว (เช่น บิลรวมค่าน้ำ+ค่าไฟ+ค่าห้อง+ค่าเน็ตในใบเดียว ให้แยกเป็นคนละรายการตามหมวดของมัน)
- แต่ละรายการ: category ต้องเป็นหนึ่งในหมวดต่อไปนี้ (เลือกให้ตรงที่สุด ไม่ใช่กว้างที่สุด):${CATEGORY_DESCRIPTIONS_TH}
- amount คือจำนวนเงินของรายการนั้นเป็นตัวเลข (บาท)
- note ใส่คำอธิบายสั้นๆ ของรายการนั้น (เช่นชื่อรายการในบิล/ชื่อร้าน) ถ้าไม่มีให้ใส่ null
- ถ้าชื่อผู้รับเงิน/ชื่อร้านในสลิปตรงกับผู้ให้บริการที่รู้จัก (เช่น Anthropic, OpenAI, Netflix, Spotify) ให้จัดเป็น SUBSCRIPTION แม้ข้อความจะดูกำกวม
- ใช้ OTHER เท่าที่จำเป็นจริงๆ เท่านั้น ถ้ามีหมวดที่เจาะจงกว่าให้เลือกหมวดนั้นก่อน`;

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
