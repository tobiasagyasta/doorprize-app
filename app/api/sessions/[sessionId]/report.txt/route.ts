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
    select: { id: true, name: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const draws = await prisma.draw.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    include: {
      prize: true,
      winners: {
        orderBy: { createdAt: "asc" },
        include: { contestant: true },
      },
    },
  });

  const totalWinners = draws.reduce(
    (sum, draw) => sum + draw.winners.length,
    0
  );

  const lines: string[] = [];
  lines.push(`Session: ${session.name}`);
  lines.push(`Session ID: ${session.id}`);
  lines.push(`Generated At: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`Draws: ${draws.length}`);
  lines.push(`Total Winners: ${totalWinners}`);
  lines.push("");

  if (draws.length === 0) {
    lines.push("No draws have been run yet.");
  } else {
    draws.forEach((draw, index) => {
      const drawNumber = index + 1;
      const prizeName =
        draw.prize?.name ??
        draw.winners[0]?.prizeName ??
        "Prize";
      const winnerNames = [...draw.winners].sort((a, b) =>
        a.contestant.name.localeCompare(b.contestant.name)
      );

      lines.push(
        `[${drawNumber}] ${draw.createdAt.toISOString()} — Prize: ${prizeName} (${draw.winners.length})`
      );
      winnerNames.forEach((winner) => {
        lines.push(`- ${winner.contestant.name}`);
      });
      lines.push("");
    });
  }

  const text = lines.join("\n");

  return new NextResponse(text, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="doorprize-report-${sessionId}.txt"`,
    },
  });
}
