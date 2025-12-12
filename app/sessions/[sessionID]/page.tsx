"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type ImportSummary = {
  sessionId: string;
  totalRows: number;
  validNames: number;
  inserted: number;
  skippedDuplicatesInFile: number;
  skippedDuplicatesInDb: number;
};

type ContestantRow = {
  id: string;
  name: string;
  hasPrize: boolean;
  prizeName: string | null;
};

type PrizeRow = {
  id: string;
  name: string;
  quantity: number;
  alreadyDrawn?: number;
  remaining?: number;
};

type DrawWinner = {
  contestantId: string;
  name: string;
  prizeName: string;
};

export default function SessionPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId ?? "";

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);

  const [contestants, setContestants] = useState<ContestantRow[]>([]);
  const [totalContestants, setTotalContestants] = useState<number | null>(null);
  const [eligibleContestants, setEligibleContestants] = useState<number | null>(
    null
  );
  const [contestantError, setContestantError] = useState<string | null>(null);
  const [contestantLoading, setContestantLoading] = useState(false);

  const [prizeName, setPrizeName] = useState("");
  const [prizeQuantity, setPrizeQuantity] = useState<string>("");
  const [prizeSubmitting, setPrizeSubmitting] = useState(false);
  const [prizeError, setPrizeError] = useState<string | null>(null);
  const [prizes, setPrizes] = useState<PrizeRow[]>([]);
  const [prizeLoading, setPrizeLoading] = useState(false);
  const [prizeListError, setPrizeListError] = useState<string | null>(null);

  const [drawPrizeId, setDrawPrizeId] = useState("");
  const [drawQuantity, setDrawQuantity] = useState<string>("");
  const [drawSubmitting, setDrawSubmitting] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [drawWinners, setDrawWinners] = useState<DrawWinner[] | null>(null);
  const [drawCount, setDrawCount] = useState<number | null>(null);
  const [drawStatusError, setDrawStatusError] = useState<string | null>(null);

  const fetchContestants = useCallback(async () => {
    if (!sessionId) return;
    setContestantLoading(true);
    setContestantError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/contestants`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to load contestants");
      }
      const data = (await res.json()) as {
        total: number;
        eligible: number;
        contestants: ContestantRow[];
      };
      setContestants(data.contestants);
      setTotalContestants(data.total);
      setEligibleContestants(data.eligible);
    } catch (err) {
      setContestantError((err as Error).message);
    } finally {
      setContestantLoading(false);
    }
  }, [sessionId]);

  const fetchPrizes = useCallback(async () => {
    if (!sessionId) return;
    setPrizeLoading(true);
    setPrizeListError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/prizes`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to load prizes");
      }
      const data = (await res.json()) as {
        prizes: PrizeRow[];
      };
      setPrizes(data.prizes);
    } catch (err) {
      setPrizeListError((err as Error).message);
    } finally {
      setPrizeLoading(false);
    }
  }, [sessionId]);

  const fetchDrawStatus = useCallback(async () => {
    if (!sessionId) return;
    setDrawStatusError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/draws`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to load draw status");
      }
      const data = (await res.json()) as { drawCount: number };
      setDrawCount(data.drawCount);
    } catch (err) {
      setDrawStatusError((err as Error).message);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchContestants();
    fetchPrizes();
    fetchDrawStatus();
  }, [fetchContestants, fetchPrizes, fetchDrawStatus]);

  const handleUpload = async () => {
    if (!file) {
      setUploadError("Choose a CSV file to upload.");
      return;
    }

    setUploadError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/contestants/import`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Upload failed");
      }

      setResult(data as ImportSummary);
      setFile(null);
      await fetchContestants();
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const parsedQuantity = Number(prizeQuantity);
  const quantityInvalid =
    !Number.isInteger(parsedQuantity) ||
    parsedQuantity < 1 ||
    (eligibleContestants !== null && parsedQuantity > eligibleContestants);

  const handlePrizeSubmit = async () => {
    if (
      !prizeName.trim() ||
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity < 1
    ) {
      setPrizeError("Enter a prize name and valid quantity.");
      return;
    }

    if (eligibleContestants !== null && parsedQuantity > eligibleContestants) {
      setPrizeError("Quantity cannot exceed eligible contestants.");
      return;
    }

    setPrizeError(null);
    setPrizeSubmitting(true);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/prizes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: prizeName,
          quantity: parsedQuantity,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to create prize");
      }

      setPrizeName("");
      setPrizeQuantity("");
      await fetchContestants();
      await fetchPrizes();
      await fetchDrawStatus();
    } catch (err) {
      setPrizeError((err as Error).message);
    } finally {
      setPrizeSubmitting(false);
    }
  };

  const selectedPrize = prizes.find((p) => p.id === drawPrizeId);
  const parsedDrawQuantity = Number(drawQuantity);
  const drawQuantityInvalid =
    !Number.isInteger(parsedDrawQuantity) ||
    parsedDrawQuantity < 1 ||
    (eligibleContestants !== null &&
      parsedDrawQuantity > eligibleContestants) ||
    (selectedPrize?.remaining !== undefined &&
      parsedDrawQuantity > selectedPrize.remaining);

  const handleDrawSubmit = async () => {
    if (!selectedPrize) {
      setDrawError("Select a prize to draw.");
      return;
    }

    if (!Number.isInteger(parsedDrawQuantity) || parsedDrawQuantity < 1) {
      setDrawError("Enter a valid quantity.");
      return;
    }

    if (
      eligibleContestants !== null &&
      parsedDrawQuantity > eligibleContestants
    ) {
      setDrawError("Quantity exceeds eligible contestants.");
      return;
    }

    if (
      selectedPrize.remaining !== undefined &&
      parsedDrawQuantity > selectedPrize.remaining
    ) {
      setDrawError("Quantity exceeds remaining for this prize.");
      return;
    }

    setDrawError(null);
    setDrawSubmitting(true);
    setDrawWinners(null);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/draws`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prizeId: selectedPrize.id,
          quantity: parsedDrawQuantity,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to draw winners");
      }

      setDrawWinners(data.winners as DrawWinner[]);
      setDrawQuantity("");
      await fetchContestants();
      await fetchPrizes();
      await fetchDrawStatus();
    } catch (err) {
      setDrawError((err as Error).message);
    } finally {
      setDrawSubmitting(false);
    }
  };

  const handleDownloadTxt = () => {
    window.location.href = `/api/sessions/${sessionId}/report.txt`;
  };

  const handleDownloadCsv = () => {
    window.location.href = `/api/sessions/${sessionId}/report.csv`;
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Session {sessionId}</h1>
        <p className="text-sm text-gray-500">
          Upload a CSV of contestant names to import them into this session.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded border border-gray-200 p-4 shadow-sm">
        <label className="text-sm font-medium">
          CSV file (.csv or text/csv)
        </label>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const uploadedFile = event.target.files?.[0] ?? null;
            setFile(uploadedFile);
            setUploadError(null);
          }}
        />
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-blue-300"
          onClick={handleUpload}
          disabled={uploading || !file}
        >
          {uploading ? "Uploading..." : "Upload CSV"}
        </button>
        {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
        <p className="text-sm text-gray-700">
          Current contestants:{" "}
          {totalContestants !== null ? totalContestants : "Loading..."}
        </p>
      </div>

      {result && (
        <div className="rounded border border-gray-200 p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Import summary</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li>Total rows: {result.totalRows}</li>
            <li>Valid names: {result.validNames}</li>
            <li>Inserted: {result.inserted}</li>
            <li>
              Skipped duplicates in file: {result.skippedDuplicatesInFile}
            </li>
            <li>
              Skipped duplicates in database: {result.skippedDuplicatesInDb}
            </li>
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between rounded border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold">Contestants</h2>
          <p className="text-sm text-gray-600">
            Total: {totalContestants ?? "—"} · Eligible:{" "}
            {eligibleContestants ?? "—"}
          </p>
        </div>
        <button
          className="rounded bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          onClick={fetchContestants}
          disabled={contestantLoading}
        >
          {contestantLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {contestantError && (
        <p className="text-sm text-red-600">{contestantError}</p>
      )}

      <div className="overflow-x-auto rounded border border-gray-200 p-4 shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {contestants.map((contestant) => (
              <tr key={contestant.id} className="border-b last:border-0">
                <td className="py-2 pr-4">{contestant.name}</td>
                <td className="py-2">
                  {contestant.hasPrize ? (
                    <span className="text-green-700">
                      Won: {contestant.prizeName ?? "Prize"}
                    </span>
                  ) : (
                    <span className="text-blue-700">Eligible</span>
                  )}
                </td>
              </tr>
            ))}
            {contestants.length === 0 && (
              <tr>
                <td className="py-2 pr-4" colSpan={2}>
                  {contestantLoading
                    ? "Loading contestants..."
                    : "No contestants yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 rounded border border-gray-200 p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Export</h2>
        <p className="text-sm text-gray-700">
          Draws: {drawCount ?? "Loading..."}
        </p>
        {drawStatusError && (
          <p className="text-sm text-red-600">{drawStatusError}</p>
        )}
        <div className="flex gap-2">
          <button
            className="rounded bg-gray-800 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-gray-400"
            onClick={handleDownloadTxt}
            disabled={drawCount === 0 || drawCount === null}
          >
            Download TXT
          </button>
          <button
            className="rounded bg-gray-800 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-gray-400"
            onClick={handleDownloadCsv}
            disabled={drawCount === 0 || drawCount === null}
          >
            Download CSV
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded border border-gray-200 p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Create Prize</h2>
        <label className="text-sm font-medium" htmlFor="prize-name">
          Prize name
        </label>
        <input
          id="prize-name"
          type="text"
          className="rounded border px-3 py-2"
          value={prizeName}
          onChange={(e) => setPrizeName(e.target.value)}
        />
        <label className="text-sm font-medium" htmlFor="prize-quantity">
          Quantity
        </label>
        <input
          id="prize-quantity"
          type="number"
          min={1}
          className="rounded border px-3 py-2"
          value={prizeQuantity}
          onChange={(e) => setPrizeQuantity(e.target.value)}
        />
        <p className="text-sm text-gray-700">
          Eligible contestants: {eligibleContestants ?? "Loading..."}
        </p>
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-blue-300"
          onClick={handlePrizeSubmit}
          disabled={
            prizeSubmitting ||
            !prizeName.trim() ||
            quantityInvalid ||
            eligibleContestants === null
          }
        >
          {prizeSubmitting ? "Saving..." : "Create Prize"}
        </button>
        {prizeError && <p className="text-sm text-red-600">{prizeError}</p>}
        {quantityInvalid && prizeQuantity !== "" && (
          <p className="text-sm text-orange-700">
            Enter an integer not exceeding eligible contestants.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded border border-gray-200 p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Draw Winners</h2>
        <label className="text-sm font-medium" htmlFor="draw-prize">
          Prize
        </label>
        <select
          id="draw-prize"
          className="rounded border px-3 py-2"
          value={drawPrizeId}
          onChange={(e) => setDrawPrizeId(e.target.value)}
        >
          <option value="">Select a prize</option>
          {prizes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} (qty {p.quantity}
              {p.remaining !== undefined ? `, remaining ${p.remaining}` : ""})
            </option>
          ))}
        </select>
        {prizeListError && (
          <p className="text-sm text-red-600">{prizeListError}</p>
        )}
        <label className="text-sm font-medium" htmlFor="draw-quantity">
          Quantity
        </label>
        <input
          id="draw-quantity"
          type="number"
          min={1}
          className="rounded border px-3 py-2"
          value={drawQuantity}
          onChange={(e) => setDrawQuantity(e.target.value)}
        />
        <p className="text-sm text-gray-700">
          Eligible contestants: {eligibleContestants ?? "Loading..."}
        </p>
        {selectedPrize?.remaining !== undefined && (
          <p className="text-sm text-gray-700">
            Remaining for prize: {selectedPrize.remaining}
          </p>
        )}
        <button
          className="rounded bg-green-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-green-300"
          onClick={handleDrawSubmit}
          disabled={
            drawSubmitting ||
            !drawPrizeId ||
            drawQuantityInvalid ||
            eligibleContestants === null ||
            prizeLoading
          }
        >
          {drawSubmitting ? "Drawing..." : "Draw"}
        </button>
        {drawError && <p className="text-sm text-red-600">{drawError}</p>}
        {drawQuantityInvalid && drawQuantity !== "" && (
          <p className="text-sm text-orange-700">
            Enter an integer not exceeding eligible or remaining.
          </p>
        )}
        {drawWinners && drawWinners.length > 0 && (
          <div className="rounded border border-gray-200 p-3">
            <h3 className="font-semibold">Winners</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {drawWinners.map((winner) => (
                <li key={winner.contestantId}>
                  {winner.name} — {winner.prizeName}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
