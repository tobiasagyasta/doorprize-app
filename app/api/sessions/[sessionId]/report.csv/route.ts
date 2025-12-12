import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params =
  | { params: { sessionId: string | string[] } | Promise<{ sessionId: string | string[] }> }
  | undefined;

function normalizeSessionId(raw: string | string[] | undefined): string | null {
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

function escapeCsv(value: string): string {
  const needsQuote = /[",\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
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
    orderBy: { createdAt: "asc" },
    include: {
      prize: true,
      winners: {
        orderBy: { createdAt: "asc" },
        include: { contestant: true },
      },
    },
  });

  const rows: string[] = [];
  rows.push(
    [
      "drawNumber",
      "drawId",
      "drawCreatedAt",
      "prizeId",
      "prizeName",
      "contestantId",
      "contestantName",
      "wonAt",
    ].join(",")
  );

  draws.forEach((draw, index) => {
    const drawNumber = index + 1;
    const prizeName =
      draw.prize?.name ??
      draw.winners[0]?.prizeName ??
      "Prize";
    draw.winners
      .map((winner) => ({
        contestantName: winner.contestant.name,
        winner,
      }))
      .sort((a, b) => a.contestantName.localeCompare(b.contestantName))
      .forEach(({ winner, contestantName }) => {
        rows.push(
          [
            drawNumber.toString(),
            draw.id,
            draw.createdAt.toISOString(),
            draw.prizeId,
            prizeName,
            winner.contestantId,
            contestantName,
            winner.createdAt.toISOString(),
          ]
            .map(escapeCsv)
            .join(",")
        );
      });
  });

  const csv = rows.join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="doorprize-report-${sessionId}.csv"`,
    },
  });
}
