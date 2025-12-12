import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params =
  | {
      params:
        | { sessionId: string | string[] }
        | Promise<{ sessionId: string | string[] }>;
    }
  | undefined;

function normalizeSessionId(raw: string | string[] | undefined): string | null {
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

export async function POST(req: Request, context: Params) {
  const params = await Promise.resolve(context?.params);
  const sessionId =
    normalizeSessionId(params?.sessionId) ||
    new URL(req.url).pathname.split("/")[3];

  if (!sessionId) {
    return NextResponse.json(
      { error: "Session id is required in the route" },
      { status: 400 }
    );
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const nameValue = (body as { name?: unknown }).name;
  const name = typeof nameValue === "string" ? nameValue.trim() : "";
  const quantityRaw = (body as { quantity?: unknown }).quantity;
  const quantity =
    typeof quantityRaw === "number"
      ? quantityRaw
      : typeof quantityRaw === "string" && quantityRaw.trim() !== ""
      ? Number(quantityRaw)
      : NaN;

  if (!name) {
    return NextResponse.json(
      { error: "Prize name is required" },
      { status: 400 }
    );
  }

  if (!Number.isInteger(quantity)) {
    return NextResponse.json(
      { error: "Quantity must be an integer" },
      { status: 400 }
    );
  }

  if (quantity < 1) {
    return NextResponse.json(
      { error: "Quantity must be at least 1" },
      { status: 400 }
    );
  }

  // if (quantity > 50) {
  //   return NextResponse.json(
  //     { error: "Quantity must be 50 or less" },
  //     { status: 400 }
  //   );
  // }

  const eligibleCount = await prisma.contestant.count({
    where: { sessionId, winner: null },
  });

  if (quantity > eligibleCount) {
    return NextResponse.json(
      { error: "Quantity cannot exceed eligible contestants" },
      { status: 400 }
    );
  }

  const prize = await prisma.prize.create({
    data: {
      name,
      quantity,
      sessionId,
    },
  });

  return NextResponse.json({
    id: prize.id,
    name: prize.name,
    quantity: prize.quantity,
    eligibleAtCreation: eligibleCount,
    createdAt: prize.createdAt,
  });
}

export async function GET(req: Request, context: Params) {
  const params = await Promise.resolve(context?.params);
  const sessionId =
    normalizeSessionId(params?.sessionId) ||
    new URL(req.url).pathname.split("/")[3];

  if (!sessionId) {
    return NextResponse.json(
      { error: "Session id is required in the route" },
      { status: 400 }
    );
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const prizes = await prisma.prize.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });

  const drawCounts = await prisma.draw.findMany({
    where: { sessionId },
    select: {
      prizeId: true,
      _count: { select: { winners: true } },
    },
  });

  const drawnMap = new Map<string, number>();
  drawCounts.forEach((d) => {
    const current = drawnMap.get(d.prizeId) ?? 0;
    drawnMap.set(d.prizeId, current + d._count.winners);
  });

  return NextResponse.json({
    sessionId,
    prizes: prizes.map((prize) => {
      const drawn = drawnMap.get(prize.id) ?? 0;
      const remaining = Math.max(prize.quantity - drawn, 0);
      return {
        id: prize.id,
        name: prize.name,
        quantity: prize.quantity,
        createdAt: prize.createdAt,
        alreadyDrawn: drawn,
        remaining,
      };
    }),
  });
}
