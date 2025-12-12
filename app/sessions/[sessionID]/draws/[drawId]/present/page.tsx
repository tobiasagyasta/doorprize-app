"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams } from "next/navigation";

type Winner = {
  contestantId: string;
  name: string;
};

type Contestant = {
  id: string;
  name: string;
};

type DrawData = {
  drawId: string;
  sessionId: string;
  createdAt: string;
  prize: { id: string; name: string };
  winners: Winner[];
};

type Phase = "ROLLING" | "REVEALED";

export default function PresentDrawPage() {
  const params = useParams<{ sessionID: string; drawId: string }>();
  const sessionId = params?.sessionID;
  const drawId = params?.drawId;

  const [data, setData] = useState<DrawData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [eligibleContestants, setEligibleContestants] = useState<Contestant[]>(
    []
  );

  const [phase, setPhase] = useState<Phase>("ROLLING");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!sessionId || !drawId) return;
      setLoading(true);
      setError(null);

      try {
        const [drawRes, eligibleRes] = await Promise.all([
          fetch(`/api/sessions/${sessionId}/draws/${drawId}`, {
            cache: "no-store",
          }),
          fetch(`/api/sessions/${sessionId}/contestants?eligible=true`, {
            cache: "no-store",
          }),
        ]);

        const drawJson = await drawRes.json();
        if (!drawRes.ok)
          throw new Error(drawJson?.error || "Failed to load draw");

        const eligibleJson = await eligibleRes.json();
        if (!eligibleRes.ok)
          throw new Error(
            eligibleJson?.error || "Failed to load eligible contestants"
          );

        const parsed = drawJson as DrawData;
        setData(parsed);
        setEligibleContestants(
          (eligibleJson.contestants as Contestant[] | undefined) ?? []
        );
        setActiveIndex(0);
        setPhase((parsed.winners?.length ?? 0) === 1 ? "ROLLING" : "REVEALED");
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sessionId, drawId]);

  const winners = data?.winners ?? [];
  const rollingPool =
    winners.length === 1 && eligibleContestants.length > 0
      ? eligibleContestants.map((c) => ({
          contestantId: c.id,
          name: c.name,
        }))
      : winners;

  useEffect(() => {
    setActiveIndex(0);
    if (winners.length === 1) {
      setPhase("ROLLING");
    } else if (winners.length > 1) {
      setPhase("REVEALED");
    }
  }, [winners.length]);

  // Rolling ticker: only runs in ROLLING phase
  useEffect(() => {
    if (phase !== "ROLLING") return;
    if (winners.length !== 1) return;
    if (rollingPool.length === 0) return;

    const timer = setInterval(() => {
      setActiveIndex((prev) => {
        if (rollingPool.length <= 1) return 0;

        let next;
        do {
          next = Math.floor(Math.random() * rollingPool.length);
        } while (next === prev);

        return next;
      });
    }, 140); // fast roll; tweak for drama

    return () => clearInterval(timer);
  }, [phase, winners.length, rollingPool.length]);

  // Winner grid animation (simple, readable)
  const gridVariants = useMemo(
    () => ({
      hidden: { opacity: 0 },
      show: {
        opacity: 1,
        transition: {
          staggerChildren:
            winners.length <= 10 ? 0.12 : winners.length <= 25 ? 0.07 : 0.04,
        },
      },
    }),
    [winners.length]
  );

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.96 },
    show: { opacity: 1, scale: 1, transition: { duration: 0.35 } },
  };

  const stopAndReveal = () => setPhase("REVEALED");
  const restartRolling = () => {
    setActiveIndex(0);
    setPhase("ROLLING");
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-black via-gray-900 to-black text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-12">
        <header className="text-center">
          <p className="text-sm uppercase text-gray-400">
            Session {data?.sessionId ?? sessionId}
          </p>
          <h1
            className="font-extrabold leading-tight drop-shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
            style={{ fontSize: "clamp(48px, 5vw, 96px)" }}
          >
            {data?.prize?.name ?? (loading ? "Loading..." : "Prize")}
          </h1>
          <p className="text-lg text-gray-300">
            {data ? new Date(data.createdAt).toLocaleString() : ""}
          </p>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </header>

        {/* ROLLING VIEW */}
        <AnimatePresence mode="wait">
          {phase === "ROLLING" && winners.length === 1 && (
            <motion.div
              key="rolling"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_20px_80px_rgba(0,0,0,0.45)]"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12),transparent_55%)]" />
              <div className="relative flex flex-col items-center justify-center gap-3 py-12">
                <p className="mb-1 text-sm uppercase tracking-[0.25em] text-gray-300">
                  Rolling…
                </p>

                <div className="relative rounded-full border border-white/20 bg-black/40 px-10 py-6 shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur">
                  {/* This animates between names without showing the whole list */}
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={rollingPool[activeIndex]?.contestantId || "empty"}
                      initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -18, filter: "blur(6px)" }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="block text-center leading-tight text-white drop-shadow-[0_6px_24px_rgba(0,0,0,0.65)]"
                      style={{
                        fontSize: "clamp(38px, 5vw, 50px)",
                        fontWeight: 800,
                        letterSpacing: "-0.01em",
                        wordBreak: "break-word",
                      }}
                    >
                      {rollingPool[activeIndex]?.name ?? ""}
                    </motion.span>
                  </AnimatePresence>
                </div>

                <p className="mt-4 text-gray-300">
                  {winners.length > 0
                    ? `Winners to reveal: ${winners.length}`
                    : "No winners yet."}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* REVEALED VIEW */}
        <AnimatePresence mode="wait">
          {(phase === "REVEALED" || winners.length > 1) && (
            <motion.div
              key="revealed"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
              className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_20px_80px_rgba(0,0,0,0.45)]"
            >
              <motion.div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                }}
                variants={gridVariants}
                initial="hidden"
                animate="show"
              >
                {winners.map((winner) => (
                  <motion.div
                    key={winner.contestantId}
                    variants={itemVariants}
                    className="flex min-h-30 items-center justify-center rounded-2xl bg-white/10 p-6 text-center shadow-lg ring-1 ring-white/10 backdrop-blur"
                  >
                    <span
                      className="block whitespace-normal text-white drop-shadow-[0_4px_14px_rgba(0,0,0,0.55)]"
                      style={{
                        fontWeight: 800,
                        fontSize: "clamp(30px, 3vw, 35px)",
                        wordBreak: "break-word",
                        lineHeight: 1.05,
                      }}
                    >
                      {winner.name}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading && <p className="text-center text-gray-400">Loading...</p>}
      </div>

      {/* Controls */}
      {winners.length === 1 && (
        <div className="fixed bottom-4 right-4 flex gap-2 text-sm text-white/80">
          {phase === "ROLLING" ? (
            <button
              className="rounded bg-white/10 px-3 py-2 hover:bg-white/20"
              onClick={stopAndReveal}
            >
              ⏹ Stop & Reveal
            </button>
          ) : (
            <button
              className="rounded bg-white/10 px-3 py-2 hover:bg-white/20"
              onClick={restartRolling}
            >
              🔄 Roll Again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
