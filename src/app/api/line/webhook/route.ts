import { randomUUID } from "node:crypto";
import { buffer } from "node:stream/consumers";
import { NextResponse } from "next/server";
import { LINE_SIGNATURE_HTTP_HEADER_NAME, validateSignature, webhook } from "@line/bot-sdk";
import {
  extractExpenseFromImageWithFallback,
  extractExpenseFromTextWithFallback,
} from "@/lib/expense-extraction";
import type { ExpenseExtraction } from "@/lib/expense-extraction-schema";
import {
  cancelExpensesByIds,
  confirmExpenseBatch,
  listRecentConfirmedBatches,
  previewExpenseBatchesByIndex,
  previewLatestExpenseBatch,
  rejectExpenseBatch,
} from "@/lib/expense";
import { getOrCreateHouseholdMember, type HouseholdMemberContext } from "@/lib/household";
import { lineBlobClient, lineClient } from "@/lib/line-client";
import { prisma } from "@/lib/prisma";
import {
  EXPENSE_CATEGORY_LABEL_TH,
  EXPENSE_SOURCE,
  type ExpenseCategoryValue,
  type ExpenseSourceValue,
} from "@/constants/expense-category";
import {
  CANCEL_BY_INDEX_PATTERN,
  CANCEL_COMMANDS,
  CANCEL_CONFIRM_PREFIX,
  CANCEL_REJECT,
  HISTORY_COMMANDS,
  RICH_MENU_POSTBACK,
} from "@/constants/bot-commands";
import type { Expense } from "@/generated/prisma/client";

const channelSecret = process.env.LINE_CHANNEL_SECRET!;

const USAGE_GUIDE_TEXT = `📖 วิธีใช้งาน

💾 บันทึกค่าใช้จ่าย
พิมพ์ข้อความบอกรายการและจำนวนเงิน เช่น "ค่าไฟ 850" หรือส่งรูปสลิป/ใบเสร็จมาได้เลย บอทจะถามยืนยันก่อนบันทึกทุกครั้ง

📋 ดูประวัติ
พิมพ์ "ประวัติ" เพื่อดูรายการล่าสุด 10 รายการ พร้อมเลขลำดับ

❌ ยกเลิกรายการ
- พิมพ์ "ยกเลิก" เพื่อยกเลิกรายการล่าสุด
- พิมพ์ "ยกเลิก [เลข]" เพื่อยกเลิกรายการตามลำดับที่ดูจาก "ประวัติ" เช่น "ยกเลิก 3" หรือ "ยกเลิก 2,3"
ทุกครั้งบอทจะถามยืนยันก่อนลบจริง

📊 ดูสรุปค่าใช้จ่าย
กดปุ่ม "ดูสรุป" ที่เมนูด้านล่างนี้ เพื่อเปิดหน้าสรุปค่าใช้จ่ายแบบละเอียด`;

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get(LINE_SIGNATURE_HTTP_HEADER_NAME);

  if (!signature || !validateSignature(body, channelSecret, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const { events } = JSON.parse(body) as webhook.CallbackRequest;

  await Promise.all(events.map(handleEvent));

  return NextResponse.json({});
}

async function handleEvent(event: webhook.Event) {
  if (event.type !== "message" && event.type !== "postback") {
    return;
  }

  if (!event.replyToken || !event.source) {
    return;
  }

  const replyToken = event.replyToken;

  try {
    const householdMember = await getOrCreateHouseholdMember(event.source);
    if (!householdMember) {
      return;
    }

    if (event.type === "message") {
      const message = event.message;
      if (message.type === "text") {
        await handleTextMessage(message.text, replyToken, householdMember);
      } else if (message.type === "image") {
        await handleImageMessage(message.id, replyToken, householdMember);
      }
      return;
    }

    if (event.type === "postback") {
      await handlePostback(event.postback.data, replyToken, householdMember);
      return;
    }
  } catch (error) {
    console.error("Failed to handle LINE event", error);
  }
}

async function handleTextMessage(
  text: string,
  replyToken: string,
  householdMember: HouseholdMemberContext,
) {
  const trimmedText = text.trim();

  if ((CANCEL_COMMANDS as readonly string[]).includes(trimmedText)) {
    await handleCancelCommand(replyToken, householdMember);
    return;
  }

  if ((HISTORY_COMMANDS as readonly string[]).includes(trimmedText)) {
    await handleHistoryCommand(replyToken, householdMember);
    return;
  }

  const indexMatch = trimmedText.match(CANCEL_BY_INDEX_PATTERN);
  if (indexMatch) {
    const indices = [...indexMatch[1].matchAll(/\d+/g)].map((match) => Number(match[0]));
    await handleCancelByIndexCommand(indices, replyToken, householdMember);
    return;
  }

  const lineTo = householdMember.household.lineGroupId ?? householdMember.household.lineUserId!;
  const extraction = await extractExpenseFromTextWithFallback(text, lineTo);
  await createPendingBatchAndAskConfirm(extraction, replyToken, householdMember, EXPENSE_SOURCE.TEXT);
}

async function handleImageMessage(
  messageId: string,
  replyToken: string,
  householdMember: HouseholdMemberContext,
) {
  const contentStream = await lineBlobClient.getMessageContent(messageId);
  const imageBuffer = await buffer(contentStream);
  const base64Data = imageBuffer.toString("base64");

  const lineTo = householdMember.household.lineGroupId ?? householdMember.household.lineUserId!;
  const extraction = await extractExpenseFromImageWithFallback(base64Data, "image/jpeg", lineTo);
  await createPendingBatchAndAskConfirm(extraction, replyToken, householdMember, EXPENSE_SOURCE.IMAGE);
}

async function handleCancelCommand(replyToken: string, householdMember: HouseholdMemberContext) {
  const toCancel = await previewLatestExpenseBatch(householdMember.household.id, householdMember.member.id);
  await replyCancelConfirmation(replyToken, toCancel, "ไม่พบรายการล่าสุดของคุณที่จะยกเลิก");
}

async function handleHistoryCommand(replyToken: string, householdMember: HouseholdMemberContext) {
  const batches = await listRecentConfirmedBatches(householdMember.household.id, householdMember.member.id);

  if (batches.length === 0) {
    await lineClient.replyMessage({
      replyToken,
      messages: [{ type: "text", text: "ยังไม่มีประวัติรายการที่บันทึกไว้" }],
    });
    return;
  }

  const lines = batches.map((batch, index) => formatBatchLine(batch, index + 1));

  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text: `ประวัติล่าสุดของคุณ:\n${lines.join("\n")}\n\nพิมพ์ "ยกเลิก [เลข]" เพื่อลบ เช่น "ยกเลิก 1 3"`,
      },
    ],
  });
}

async function handleCancelByIndexCommand(
  indices: number[],
  replyToken: string,
  householdMember: HouseholdMemberContext,
) {
  const toCancel = await previewExpenseBatchesByIndex(
    householdMember.household.id,
    householdMember.member.id,
    indices,
  );
  await replyCancelConfirmation(
    replyToken,
    toCancel,
    'ไม่พบรายการตามลำดับที่ระบุ ลองพิมพ์ "ประวัติ" เพื่อดูลำดับล่าสุดอีกครั้ง',
  );
}

// Shared by both cancel entry points ("ยกเลิก" and "ยกเลิก <index>") — shows
// what would be cancelled and waits for an explicit confirm postback before
// actually deleting anything, mirroring the same confirm/reject pattern used
// right after saving a new expense.
const MAX_CANCEL_CONFIRM_ITEMS = 10;

async function replyCancelConfirmation(
  replyToken: string,
  toCancel: Expense[],
  emptyMessage: string,
) {
  if (toCancel.length === 0) {
    await lineClient.replyMessage({
      replyToken,
      messages: [{ type: "text", text: emptyMessage }],
    });
    return;
  }

  // Postback data has a 300-character limit; a cuid is ~25 chars, so this
  // comfortably covers realistic multi-item cancellations without risking
  // an oversized payload.
  if (toCancel.length > MAX_CANCEL_CONFIRM_ITEMS) {
    await lineClient.replyMessage({
      replyToken,
      messages: [
        {
          type: "text",
          text: `พบ ${toCancel.length} รายการ ยกเลิกได้ครั้งละไม่เกิน ${MAX_CANCEL_CONFIRM_ITEMS} รายการ ลองระบุลำดับให้น้อยลง`,
        },
      ],
    });
    return;
  }

  const data = `${CANCEL_CONFIRM_PREFIX}${toCancel.map((expense) => expense.id).join(",")}`;
  const summary = formatItemsList(toCancel);
  // The confirm template's `text` field has a 240-character limit — truncate
  // the preview rather than risk the whole reply failing on a long list of
  // items with long notes. altText (the notification/desktop-fallback text)
  // keeps the full summary since it isn't subject to that limit.
  const CONFIRM_TEXT_LIMIT = 220;
  const promptText = `ต้องการยกเลิกรายการนี้ใช่ไหม?\n${summary}`;
  const truncatedPrompt =
    promptText.length > CONFIRM_TEXT_LIMIT ? `${promptText.slice(0, CONFIRM_TEXT_LIMIT - 1)}…` : promptText;

  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: "template",
        altText: `ยืนยันยกเลิก - ${summary}`,
        template: {
          type: "confirm",
          text: truncatedPrompt,
          actions: [
            { type: "postback", label: "ยืนยัน", data, displayText: "ยืนยันยกเลิก" },
            { type: "postback", label: "ไม่ใช่", data: CANCEL_REJECT, displayText: "ไม่ยกเลิก" },
          ],
        },
      },
    ],
  });
}

async function handlePostback(
  data: string,
  replyToken: string,
  householdMember: HouseholdMemberContext,
) {
  if (data === RICH_MENU_POSTBACK.USAGE_GUIDE) {
    await lineClient.replyMessage({ replyToken, messages: [{ type: "text", text: USAGE_GUIDE_TEXT }] });
    return;
  }

  if (data === CANCEL_REJECT) {
    await lineClient.replyMessage({
      replyToken,
      messages: [{ type: "text", text: "ไม่ได้ยกเลิกรายการนี้" }],
    });
    return;
  }

  if (data.startsWith(CANCEL_CONFIRM_PREFIX)) {
    const expenseIds = data.slice(CANCEL_CONFIRM_PREFIX.length).split(",").filter(Boolean);
    const cancelled = await cancelExpensesByIds(
      householdMember.household.id,
      householdMember.member.id,
      expenseIds,
    );

    if (cancelled.length === 0) {
      await lineClient.replyMessage({
        replyToken,
        messages: [{ type: "text", text: "ไม่พบรายการที่จะยกเลิก (อาจถูกยกเลิกไปแล้ว)" }],
      });
      return;
    }

    const payerName = householdMember.member.displayName ?? "ไม่ทราบชื่อ";
    const header = cancelled.length > 1 ? `ยกเลิกแล้ว ❌ (${cancelled.length} รายการ)` : "ยกเลิกแล้ว ❌";
    await lineClient.replyMessage({
      replyToken,
      messages: [{ type: "text", text: `${header}\nโดย: ${payerName}\n${formatItemsList(cancelled)}` }],
    });
    return;
  }

  const [action, batchId] = data.split(":");
  const payerName = householdMember.member.displayName ?? "ไม่ทราบชื่อ";

  if (action === "confirm" && batchId) {
    const items = await confirmExpenseBatch(householdMember.household.id, batchId, householdMember.member.id);

    if (items.length === 0) {
      await lineClient.replyMessage({
        replyToken,
        messages: [{ type: "text", text: "ไม่พบรายการที่จะยืนยัน (อาจถูกยกเลิกไปแล้ว)" }],
      });
      return;
    }

    const header = items.length > 1 ? `บันทึกแล้ว ✅ (${items.length} รายการ)` : "บันทึกแล้ว ✅";
    await lineClient.replyMessage({
      replyToken,
      messages: [{ type: "text", text: `${header}\nโดย: ${payerName}\n${formatItemsList(items)}` }],
    });
    return;
  }

  if (action === "reject" && batchId) {
    const deletedCount = await rejectExpenseBatch(householdMember.household.id, batchId, householdMember.member.id);
    await lineClient.replyMessage({
      replyToken,
      messages: [
        {
          type: "text",
          text: deletedCount > 0 ? "ยกเลิกแล้ว ❌ ไม่ได้บันทึกรายการนี้" : "ไม่พบรายการที่จะยกเลิก",
        },
      ],
    });
  }
}

async function createPendingBatchAndAskConfirm(
  extraction: ExpenseExtraction,
  replyToken: string,
  { household, member }: HouseholdMemberContext,
  sourceType: ExpenseSourceValue,
) {
  if (extraction.items.length === 0) {
    await lineClient.replyMessage({
      replyToken,
      messages: [
        {
          type: "text",
          text:
            sourceType === EXPENSE_SOURCE.IMAGE
              ? "อ่านรูปนี้ไม่พบข้อมูลค่าใช้จ่าย ลองส่งรูปสลิปที่ชัดเจนกว่านี้"
              : 'ไม่พบข้อมูลค่าใช้จ่ายในข้อความนี้ ลองพิมพ์ใหม่ เช่น "ค่าไฟ 850"',
        },
      ],
    });
    return;
  }

  // Shared across every row from this one message/slip so confirm/reject/cancel act on them together.
  const batchId = randomUUID();

  await prisma.expense.createMany({
    data: extraction.items.map((item) => ({
      householdId: household.id,
      paidByMemberId: member.id,
      batchId,
      category: item.category,
      amount: item.amount,
      note: item.note,
      sourceType,
      confirmed: false,
    })),
  });

  const payerName = member.displayName ?? "ไม่ทราบชื่อ";
  const summary = `โดย: ${payerName}\n${formatItemsList(extraction.items)}`;

  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: "template",
        altText: `ยืนยันบันทึกค่าใช้จ่าย - ${summary}`,
        template: {
          type: "confirm",
          text: `${summary}\nยืนยันบันทึกไหม?`,
          actions: [
            { type: "postback", label: "ยืนยัน", data: `confirm:${batchId}`, displayText: "ยืนยัน" },
            { type: "postback", label: "ไม่ใช่", data: `reject:${batchId}`, displayText: "ไม่ใช่" },
          ],
        },
      },
    ],
  });
}

function formatBatchLine(batch: Expense[], index: number): string {
  const summary = batch
    .map((expense) => `${EXPENSE_CATEGORY_LABEL_TH[expense.category]} ${expense.amount} บาท`)
    .join(", ");
  const time = batch[0].createdAt.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${index}. ${summary} (${time})`;
}

function formatItemsList(
  items: { category: ExpenseCategoryValue; amount: number | { toString(): string }; note: string | null }[],
): string {
  const lines = items.map(
    (item) =>
      `- ${EXPENSE_CATEGORY_LABEL_TH[item.category]}: ${item.amount} บาท${item.note ? ` (${item.note})` : ""}`,
  );

  if (items.length > 1) {
    const total = items.reduce((sum, item) => sum + Number(item.amount), 0);
    lines.push(`รวมทั้งหมด: ${total} บาท`);
  }

  return lines.join("\n");
}
