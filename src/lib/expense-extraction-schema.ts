import { z } from "zod";
import { EXPENSE_CATEGORY, type ExpenseCategoryValue } from "@/constants/expense-category";

// Shared between the Anthropic (primary) and Gemini (fallback) extraction
// providers so both are constrained to the exact same shape and category
// enum — a provider switch never changes what the rest of the app receives.
const categoryValues = Object.values(EXPENSE_CATEGORY) as [
  ExpenseCategoryValue,
  ...ExpenseCategoryValue[],
];

export const ExpenseItemSchema = z.object({
  category: z.enum(categoryValues),
  amount: z.number(),
  note: z.string().nullable(),
});

export const ExpenseExtractionSchema = z.object({
  items: z.array(ExpenseItemSchema),
});

export type ExpenseItem = z.infer<typeof ExpenseItemSchema>;
export type ExpenseExtraction = z.infer<typeof ExpenseExtractionSchema>;

export const CATEGORY_DESCRIPTIONS_TH = `
- RENT: ค่าที่พัก/ค่าเช่า
- UTILITIES: ค่าน้ำ ค่าไฟ
- INTERNET: ค่าอินเทอร์เน็ต/ไวไฟ/มือถือรายเดือน
- SUBSCRIPTION: ค่าสมาชิก/บริการรายเดือนที่หักซ้ำทุกเดือน เช่น ค่าสมัคร Claude, ChatGPT, ค่า API ของผู้ให้บริการ AI, Netflix, Spotify, YouTube Premium (ชื่อผู้รับเงินที่มักเป็นหมวดนี้: Anthropic, OpenAI, Netflix, Spotify)
- FOOD: ของกินและเครื่องดื่มทุกอย่าง ไม่ว่าจะกินทันทีหรือซื้อตุนไว้ที่บ้าน เช่น ค่าข้าว ค่ากาแฟ เดลิเวอรี่ ร้านอาหาร น้ำดื่ม/น้ำเปล่า (เป็นขวด แพ็ค ถัง แกลลอน) น้ำแข็ง ข้าวสาร นม ไข่ ขนม ผักผลไม้ ของสด ของเข้าตู้เย็น
- GROCERIES: ของใช้สิ้นเปลืองในบ้านที่ไม่ใช่ของกิน เช่น สบู่ ผงซักฟอก แชมพู กระดาษทิชชู่ น้ำยาล้างจาน ถุงขยะ
- TRANSPORT: ค่าเดินทาง เช่น ค่า Grab/แท็กซี่ ค่าน้ำมัน ค่าทางด่วน ค่าที่จอดรถ
- HOUSEHOLD: ของใช้ในบ้านที่ไม่ใช่ของกิน/ของใช้สิ้นเปลืองประจำวัน เช่น เฟอร์นิเจอร์ เครื่องใช้ไฟฟ้า ค่าเรียกช่างซ่อม อุปกรณ์ทำความสะอาดขนาดใหญ่
- HEALTH: ค่ายา ค่าหมอ ค่าประกันสุขภาพ ค่าตรวจสุขภาพ
- SHOPPING: ของใช้ส่วนตัวที่ไม่เกี่ยวกับของใช้ร่วมกันในบ้าน เช่น เสื้อผ้า เครื่องประดับ ของที่ซื้อผ่าน Shopee/Lazada เพื่อใช้ส่วนตัว
- ENTERTAINMENT: ความบันเทิง/กิจกรรม/ท่องเที่ยว เช่น ดูหนัง คอนเสิร์ต ทริปเที่ยว ค่าเข้าสถานที่ท่องเที่ยว
- OTHER: อื่นๆ ที่ไม่เข้าพวกใดเลยจริงๆ`;

export const ITEMS_INSTRUCTIONS_TH = `- ส่งกลับเป็น items ซึ่งเป็น array ของรายการค่าใช้จ่ายที่พบทั้งหมด อาจมีมากกว่า 1 รายการถ้ามีหลายหมวดปนกันในข้อความ/สลิปเดียว (เช่น บิลรวมค่าน้ำ+ค่าไฟ+ค่าห้อง+ค่าเน็ตในใบเดียว ให้แยกเป็นคนละรายการตามหมวดของมัน)
- แต่ละรายการ: category ต้องเป็นหนึ่งในหมวดต่อไปนี้ (เลือกให้ตรงที่สุด ไม่ใช่กว้างที่สุด):${CATEGORY_DESCRIPTIONS_TH}
- amount คือจำนวนเงินของรายการนั้นเป็นตัวเลข (บาท)
- note ใส่คำอธิบายสั้นๆ ของรายการนั้น (เช่นชื่อรายการในบิล/ชื่อร้าน) ถ้าไม่มีให้ใส่ null
- คำว่า "น้ำ" ที่มาพร้อมหน่วยนับ (ขวด แพ็ค ถัง แกลลอน โหล) หรือ "น้ำดื่ม" "น้ำเปล่า" คือ FOOD แต่ "ค่าน้ำ" "ค่าน้ำประปา" (บิลรายเดือน) คือ UTILITIES
- ถ้าชื่อผู้รับเงิน/ชื่อร้านในสลิปตรงกับผู้ให้บริการที่รู้จัก (เช่น Anthropic, OpenAI, Netflix, Spotify) ให้จัดเป็น SUBSCRIPTION แม้ข้อความจะดูกำกวม
- ใช้ OTHER เท่าที่จำเป็นจริงๆ เท่านั้น ถ้ามีหมวดที่เจาะจงกว่าให้เลือกหมวดนั้นก่อน`;
