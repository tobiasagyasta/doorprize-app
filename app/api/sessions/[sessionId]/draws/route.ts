import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

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

const drawSchema = z.object({
  prizeId: z.string().min(1, "prizeId is required"),
  quantity: z.coerce
    .number()
    .int("quantity must be an integer")
    .min(1, "quantity must be at least 1"),
});

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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

  const draws = await prisma.draw.findMany({
    where: { sessionId },
    select: { _count: { select: { winners: true } } },
  });

  const drawCount = draws.length;
  const totalWinners = draws.reduce((sum, d) => sum + d._count.winners, 0);

  return NextResponse.json({ sessionId, drawCount, totalWinners });
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

  let parsed;
  try {
    const body = await req.json();
    parsed = drawSchema.parse(body);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.issues[0]?.message || "Invalid input"
        : "Invalid JSON body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const prize = await prisma.prize.findFirst({
    where: { id: parsed.prizeId, sessionId },
    select: { id: true, name: true },
  });

  if (!prize) {
    return NextResponse.json({ error: "Prize not found" }, { status: 404 });
  }

  const eligibleContestants = await prisma.contestant.findMany({
    where: { sessionId, winner: null },
    select: { id: true, name: true },
  });

  const eligibleCount = eligibleContestants.length;

  if (parsed.quantity > eligibleCount) {
    return NextResponse.json(
      { error: "Requested quantity exceeds eligible contestants" },
      { status: 400 }
    );
  }

  const shuffled = shuffle(eligibleContestants);
  const selected = shuffled.slice(0, parsed.quantity);

  try {
    const draw = await prisma.$transaction(async (tx) => {
      const createdDraw = await tx.draw.create({
        data: {
          sessionId,
          prizeId: prize.id,
        },
      });

      await tx.winner.createMany({
        data: selected.map((contestant) => ({
          contestantId: contestant.id,
          drawId: createdDraw.id,
          prizeName: prize.name,
        })),
      });

      return createdDraw;
    });

    return NextResponse.json({
      drawId: draw.id,
      sessionId,
      prize: { id: prize.id, name: prize.name },
      requestedQuantity: parsed.quantity,
      eligibleBefore: eligibleCount,
      winners: selected.map((c) => ({
        contestantId: c.id,
        name: c.name,
        prizeName: prize.name,
      })),
      createdAt: draw.createdAt,
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error:
            "Contestant already has a prize. Please refresh and try again.",
        },
        { status: 409 }
      );
    }

    throw err;
  }
}
