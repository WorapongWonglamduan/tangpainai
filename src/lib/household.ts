import type { webhook } from "@line/bot-sdk";
import { prisma } from "@/lib/prisma";
import { lineClient } from "@/lib/line-client";
import type { Household, HouseholdMember } from "@/generated/prisma/client";

export type HouseholdMemberContext = {
  household: Household;
  member: HouseholdMember;
};

export async function getOrCreateHouseholdMember(
  source: webhook.Source,
): Promise<HouseholdMemberContext | null> {
  if (!source.userId) {
    return null;
  }

  const household =
    source.type === "group"
      ? await prisma.household.upsert({
          where: { lineGroupId: source.groupId },
          create: { lineGroupId: source.groupId },
          update: {},
        })
      : source.type === "user"
        ? await prisma.household.upsert({
            where: { lineUserId: source.userId },
            create: { lineUserId: source.userId },
            update: {},
          })
        : null;

  if (!household) {
    return null;
  }

  let member = await prisma.householdMember.upsert({
    where: { lineUserId: source.userId },
    create: { householdId: household.id, lineUserId: source.userId },
    update: {},
  });

  if (!member.displayName) {
    const displayName = await fetchDisplayName(source);
    if (displayName) {
      member = await prisma.householdMember.update({
        where: { id: member.id },
        data: { displayName },
      });
    }
  }

  return { household, member };
}

async function fetchDisplayName(source: webhook.Source): Promise<string | null> {
  if (!source.userId) {
    return null;
  }

  try {
    if (source.type === "group") {
      const profile = await lineClient.getGroupMemberProfile(source.groupId, source.userId);
      return profile.displayName;
    }
    if (source.type === "user") {
      const profile = await lineClient.getProfile(source.userId);
      return profile.displayName;
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch LINE profile", error);
    return null;
  }
}
