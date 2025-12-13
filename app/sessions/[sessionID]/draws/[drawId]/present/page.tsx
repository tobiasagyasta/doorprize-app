"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams } from "next/navigation";
import Confetti from "react-confetti";
import type { Variants } from "framer-motion";

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
  const params = useParams<{ sessionId: string; drawId: string }>();
  const sessionId = params?.sessionId;
  const drawId = params?.drawId;

  const [data, setData] = useState<DrawData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);

  const [eligibleContestants, setEligibleContestants] = useState<Contestant[]>(
    []
  );

  const [phase, setPhase] = useState<Phase>("ROLLING");
  const [activeIndex, setActiveIndex] = useState(0);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

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

  useEffect(() => {
    const handleResize = () => {
      const body = document.body;
      const html = document.documentElement;

      const height = Math.max(
        body.scrollHeight,
        body.offsetHeight,
        html.clientHeight,
        html.scrollHeight,
        html.offsetHeight
      );

      setWindowSize({
        width: window.innerWidth,
        height,
      });
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize);
    };
  }, []);

  useEffect(() => {
    if (phase === "REVEALED" && winners.length > 0) {
      setShowConfetti(true);

      const timer = setTimeout(() => {
        setShowConfetti(false);
      }, 10000); // 10 seconds

      return () => clearTimeout(timer);
    }
  }, [phase, winners.length]);

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

  const itemVariants: Variants = {
    hidden: { opacity: 0, scale: 0.65, rotate: -6, y: 24 },
    show: (i: number) => ({
      opacity: 1,
      scale: [0.65, 1.14, 1],
      rotate: [-6, 4, 0],
      y: [24, -10, 0],
      transition: {
        opacity: { duration: 0.25, delay: i * 0.08 },
        scale: {
          duration: 0.6,
          ease: [0.16, 1, 0.3, 1],
          delay: i * 0.08,
        },
        rotate: {
          duration: 0.6,
          ease: [0.16, 1, 0.3, 1],
          delay: i * 0.08,
        },
        y: { duration: 0.6, delay: i * 0.08 },
      },
    }),
  };

  const nameVariants: Variants = {
    hidden: { opacity: 0, scale: 0.85, y: 10, rotate: -2 },
    show: (i: number) => ({
      opacity: 1,
      scale: [0.85, 1.2, 1],
      y: [10, -6, 0],
      rotate: [-2, 2, 0],
      transition: {
        opacity: { duration: 0.25, delay: 0.1 + i * 0.08 },
        scale: {
          duration: 0.55,
          ease: [0.18, 0.9, 0.3, 1.1],
          delay: 0.1 + i * 0.08,
        },
        rotate: {
          duration: 0.55,
          ease: [0.18, 0.9, 0.3, 1.1],
          delay: 0.1 + i * 0.08,
        },
        y: { duration: 0.55, delay: 0.1 + i * 0.08 },
      },
    }),
  };

  const stopAndReveal = () => setPhase("REVEALED");
  const restartRolling = () => {
    setActiveIndex(0);
    setPhase("ROLLING");
  };

  // const confettiActive = phase === "REVEALED" && winners.length > 0;

  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-br from-emerald-950 via-rose-950 to-emerald-950 text-white">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,197,94,0.18),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(248,113,113,0.18),transparent_38%),radial-gradient(circle_at_40%_80%,rgba(251,191,36,0.16),transparent_40%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.06)_0%,transparent_40%,rgba(255,255,255,0.06)_70%)]" />
      </div>

      <Confetti
        width={windowSize.width}
        height={windowSize.height}
        numberOfPieces={showConfetti ? 450 : 0}
        recycle={false}
        run={showConfetti}
        gravity={0.14}
        colors={["#E11D48", "#16A34A", "#FBBF24", "#FACC15", "#FFFFFF"]}
      />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-12">
        <header className="text-center">
          {/* <p className="text-sm uppercase tracking-[0.22em] text-emerald-200/80">
            Session {data?.sessionId ?? sessionId}
          </p> */}
          <h1
            className="font-extrabold leading-tight text-transparent bg-linear-to-r from-amber-200 via-white to-emerald-200 bg-clip-text drop-shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
            style={{ fontSize: "clamp(48px, 5vw, 96px)" }}
          >
            {"Pemenang "}{" "}
            {data?.prize?.name ?? (loading ? "Loading..." : "Prize")}
          </h1>
          {/* <p className="text-lg text-emerald-50/80">
            {data ? new Date(data.createdAt).toLocaleString() : ""}
          </p> */}
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
              className="relative overflow-hidden rounded-3xl border border-amber-200/20 bg-linear-to-br from-emerald-900/70 via-emerald-950/80 to-black/40 p-8 shadow-[0_25px_90px_rgba(0,0,0,0.6)]"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12),transparent_55%)]" />
              <div className="relative flex flex-col items-center justify-center gap-3 py-12">
                <p className="mb-1 text-sm uppercase tracking-[0.25em] text-amber-200/80">
                  Rolling…
                </p>

                <div className="relative rounded-full border border-emerald-200/30 bg-black/50 px-10 py-6 shadow-[0_16px_48px_rgba(0,0,0,0.6)] backdrop-blur">
                  {/* This animates between names without showing the whole list */}
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={rollingPool[activeIndex]?.contestantId || "empty"}
                      initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -18, filter: "blur(6px)" }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="block text-center leading-tight text-amber-50 drop-shadow-[0_6px_24px_rgba(0,0,0,0.65)]"
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
              className="rounded-3xl border border-amber-200/20 bg-linear-to-br from-emerald-900/80 via-black/40 to-emerald-950/70 p-8 shadow-[0_25px_90px_rgba(0,0,0,0.6)]"
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
                {winners.map((winner, index) => (
                  <motion.div
                    key={winner.contestantId}
                    variants={itemVariants}
                    custom={index}
                    // whileHover={{ scale: 1.02, y: -4 }}
                    transition={{ type: "spring", stiffness: 260, damping: 18 }}
                    className="flex min-h-30 items-center justify-center rounded-2xl bg-white/10 p-6 text-center shadow-lg ring-1 ring-amber-200/30 backdrop-blur"
                  >
                    <motion.span
                      variants={nameVariants}
                      custom={index}
                      className="block whitespace-normal text-amber-50 drop-shadow-[0_4px_14px_rgba(0,0,0,0.55)]"
                      style={{
                        fontWeight: 800,
                        fontSize: "clamp(30px, 3vw, 35px)",
                        wordBreak: "break-word",
                        lineHeight: 1.05,
                      }}
                    >
                      {winner.name}
                    </motion.span>
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
              className="rounded bg-linear-to-r from-rose-600 to-amber-500 px-3 py-2 font-semibold shadow-lg shadow-rose-900/40 transition hover:brightness-110"
              onClick={stopAndReveal}
            >
              ⏹ Stop & Reveal
            </button>
          ) : (
            <button
              className="rounded bg-linear-to-r from-emerald-600 to-emerald-500 px-3 py-2 font-semibold shadow-lg shadow-emerald-900/40 transition hover:brightness-110"
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
