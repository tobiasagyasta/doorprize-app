import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params =
  | {
      params:
        | { sessionId: string | string[]; drawId: string | string[] }
        | Promise<{ sessionId: string | string[]; drawId: string | string[] }>;
    }
  | undefined;

function normalize(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function GET(req: Request, context: Params) {
  const params = await Promise.resolve(context?.params);
  const sessionId =
    normalize(params?.sessionId) || new URL(req.url).pathname.split("/")[3];
  const drawId =
    normalize(params?.drawId) || new URL(req.url).pathname.split("/")[5];

  if (!sessionId || !drawId) {
    return NextResponse.json(
      { error: "Session id and draw id are required in the route" },
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

  const draw = await prisma.draw.findFirst({
    where: { id: drawId, sessionId },
    include: {
      prize: { select: { id: true, name: true } },
      winners: {
        orderBy: { createdAt: "asc" },
        include: { contestant: { select: { id: true, name: true } } },
      },
    },
  });

  if (!draw) {
    return NextResponse.json({ error: "Draw not found" }, { status: 404 });
  }

  return NextResponse.json({
    drawId: draw.id,
    sessionId,
    createdAt: draw.createdAt,
    prize: {
      id: draw.prize.id,
      name: draw.prize.name,
    },
    winners: draw.winners.map((winner) => ({
      contestantId: winner.contestant.id,
      name: winner.contestant.name,
    })),
  });
}
