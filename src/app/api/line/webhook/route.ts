import { randomUUID } from "node:crypto";
import { buffer } from "node:stream/consumers";
import { NextResponse } from "next/server";
import { LINE_SIGNATURE_HTTP_HEADER_NAME, validateSignature, webhook } from "@line/bot-sdk";
import { extractExpenseFromImage, extractExpenseFromText, type ExpenseExtraction } from "@/lib/anthropic";
import {
  cancelExpenseBatchesByIndex,
  cancelLatestExpenseBatch,
  confirmExpenseBatch,
  listRecentConfirmedBatches,
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
import { CANCEL_BY_INDEX_PATTERN, CANCEL_COMMANDS, HISTORY_COMMANDS } from "@/constants/bot-commands";
import type { Expense } from "@/generated/prisma/client";

const channelSecret = process.env.LINE_CHANNEL_SECRET!;

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

  const extraction = await extractExpenseFromText(text);
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

  const extraction = await extractExpenseFromImage(base64Data, "image/jpeg");
  await createPendingBatchAndAskConfirm(extraction, replyToken, householdMember, EXPENSE_SOURCE.IMAGE);
}

async function handleCancelCommand(replyToken: string, householdMember: HouseholdMemberContext) {
  const cancelled = await cancelLatestExpenseBatch(householdMember.member.id);

  if (cancelled.length === 0) {
    await lineClient.replyMessage({
      replyToken,
      messages: [{ type: "text", text: "ไม่พบรายการล่าสุดของคุณที่จะยกเลิก" }],
    });
    return;
  }

  const header =
    cancelled.length > 1 ? `ยกเลิกรายการล่าสุดแล้ว ❌ (${cancelled.length} รายการ)` : "ยกเลิกรายการล่าสุดแล้ว ❌";
  const payerName = householdMember.member.displayName ?? "ไม่ทราบชื่อ";

  await lineClient.replyMessage({
    replyToken,
    messages: [{ type: "text", text: `${header}\nโดย: ${payerName}\n${formatItemsList(cancelled)}` }],
  });
}

async function handleHistoryCommand(replyToken: string, householdMember: HouseholdMemberContext) {
  const batches = await listRecentConfirmedBatches(householdMember.member.id);

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
  const cancelled = await cancelExpenseBatchesByIndex(householdMember.member.id, indices);

  if (cancelled.length === 0) {
    await lineClient.replyMessage({
      replyToken,
      messages: [
        { type: "text", text: 'ไม่พบรายการตามลำดับที่ระบุ ลองพิมพ์ "ประวัติ" เพื่อดูลำดับล่าสุดอีกครั้ง' },
      ],
    });
    return;
  }

  const payerName = householdMember.member.displayName ?? "ไม่ทราบชื่อ";

  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text: `ยกเลิกแล้ว ❌ (${cancelled.length} รายการ)\nโดย: ${payerName}\n${formatItemsList(cancelled)}`,
      },
    ],
  });
}

async function handlePostback(
  data: string,
  replyToken: string,
  householdMember: HouseholdMemberContext,
) {
  const [action, batchId] = data.split(":");
  const payerName = householdMember.member.displayName ?? "ไม่ทราบชื่อ";

  if (action === "confirm" && batchId) {
    const items = await confirmExpenseBatch(batchId, householdMember.member.id);

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
    const deletedCount = await rejectExpenseBatch(batchId, householdMember.member.id);
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
