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

  const count = await prisma.contestant.count({
    where: { sessionId },
  });

  return NextResponse.json({ sessionId, count });
}
