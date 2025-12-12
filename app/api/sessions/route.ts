// src/app/api/sessions/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const sessions = await prisma.session.findMany();
  return NextResponse.json(sessions);
}

export async function POST(req: Request) {
  const body = await req.json();

  if (!body.name) {
    return NextResponse.json(
      { error: "Session name required" },
      { status: 400 }
    );
  }

  const session = await prisma.session.create({
    data: { name: body.name },
  });

  return NextResponse.json(session);
}
