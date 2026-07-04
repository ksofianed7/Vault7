import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/history        — list persisted download records
 * DELETE /api/history     — clear all records
 * DELETE /api/history?id= — delete one record
 */
export async function GET() {
  try {
    const records = await db.downloadRecord.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json(records);
  } catch (e) {
    // DB may be unavailable in some sandbox runs
    return NextResponse.json([], { status: 200 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  try {
    if (id) {
      await db.downloadRecord.delete({ where: { id } });
    } else {
      await db.downloadRecord.deleteMany({});
    }
  } catch {
    // ignore
  }
  return NextResponse.json({ ok: true });
}
