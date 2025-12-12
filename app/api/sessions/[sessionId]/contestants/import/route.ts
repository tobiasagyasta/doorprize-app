import { prisma } from "@/lib/prisma";
import Papa from "papaparse";
import { NextResponse } from "next/server";

type Params =
  | { params: { sessionId: string | string[] } | Promise<{ sessionId: string | string[] }> }
  | undefined;

const NAME_FIELD = "name";

function extractNames(csvText: string) {
  const headerResult = Papa.parse<Record<string, string | undefined>>(csvText, {
    header: true,
    skipEmptyLines: false,
  });

  const nameField = headerResult.meta.fields?.find(
    (field) => field?.toLowerCase() === NAME_FIELD
  );

  if (nameField) {
    const rawNames = headerResult.data.map((row) => row?.[nameField] ?? "");
    return {
      totalRows: headerResult.data.length,
      rawNames,
    };
  }

  const noHeaderResult = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: false,
  });

  const rawNames = noHeaderResult.data.map((row) =>
    Array.isArray(row) ? row[0] ?? "" : ""
  );

  return {
    totalRows: noHeaderResult.data.length,
    rawNames,
  };
}

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

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No CSV file uploaded" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const csvText = await file.text();
  const { rawNames, totalRows } = extractNames(csvText);

  const cleanedNames = rawNames
    .map((name) => (typeof name === "string" ? name.trim() : ""))
    .filter((name) => name.length > 0);

  const validNames = cleanedNames.length;

  if (validNames === 0) {
    return NextResponse.json(
      { error: "No valid contestant names found" },
      { status: 400 }
    );
  }

  const seenNames = new Set<string>();
  const uniqueNames: string[] = [];
  let skippedDuplicatesInFile = 0;

  for (const name of cleanedNames) {
    const key = name.toLowerCase();
    if (seenNames.has(key)) {
      skippedDuplicatesInFile += 1;
      continue;
    }
    seenNames.add(key);
    uniqueNames.push(name);
  }

  const existingContestants = await prisma.contestant.findMany({
    where: { sessionId },
    select: { name: true },
  });

  const existingLower = new Set(
    existingContestants.map((contestant) => contestant.name.toLowerCase())
  );

  const namesToInsert = uniqueNames.filter(
    (name) => !existingLower.has(name.toLowerCase())
  );

  const skippedDuplicatesInDb = uniqueNames.length - namesToInsert.length;

  const inserted =
    namesToInsert.length > 0
      ? (
          await prisma.contestant.createMany({
            data: namesToInsert.map((name) => ({ name, sessionId })),
            skipDuplicates: true,
          })
        ).count
      : 0;

  return NextResponse.json({
    sessionId,
    totalRows,
    validNames,
    inserted,
    skippedDuplicatesInFile,
    skippedDuplicatesInDb,
  });
}
