import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params =
  | { params: { sessionId: string | string[] } | Promise<{ sessionId: string | string[] }> }
  | undefined;

function normalizeSessionId(raw: string | string[] | undefined): string | null {
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

export async function GET(req: Request, context: Params) {
  const params = await Promise.resolve(context?.params);
  const url = new URL(req.url);
  const sessionId =
    normalizeSessionId(params?.sessionId) ||
    url.pathname.split("/")[3];
  const eligibleParam = url.searchParams.get("eligible");
  const filterEligible =
    eligibleParam !== null &&
    ["true", "1", "yes"].includes(eligibleParam.toLowerCase());

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

  const [contestants, total, eligible] = await Promise.all([
    prisma.contestant.findMany({
      where: { sessionId, ...(filterEligible ? { winner: null } : {}) },
      include: { winner: true },
      orderBy: { name: "asc" },
    }),
    prisma.contestant.count({ where: { sessionId } }),
    prisma.contestant.count({ where: { sessionId, winner: null } }),
  ]);

  return NextResponse.json({
    sessionId,
    total,
    eligible,
    contestants: contestants.map((contestant) => ({
      id: contestant.id,
      name: contestant.name,
      hasPrize: Boolean(contestant.winner),
      prizeName: contestant.winner?.prizeName ?? null,
    })),
  });
}
