import { NextResponse } from "next/server";

// Read at request time on the server (not inlined at build time like
// NEXT_PUBLIC_ vars referenced directly in client code), so changing
// NEXT_PUBLIC_LIFF_ID in .env + restarting the container takes effect
// without needing a new image build.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ liffId: process.env.NEXT_PUBLIC_LIFF_ID ?? null });
}
