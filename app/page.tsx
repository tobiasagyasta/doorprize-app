"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Session = {
  id: string;
  name: string;
};

export default function Home() {
  const [name, setName] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();

  const fetchSessions = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/sessions");
      if (!res.ok) {
        throw new Error("Failed to load sessions");
      }
      const data = (await res.json()) as Session[];
      setSessions(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  async function createSession() {
    if (!name.trim()) {
      setError("Session name is required");
      return;
    }
    setError(null);
    const res = await fetch("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ name }),
      headers: { "Content-Type": "application/json" },
    });
    const session = await res.json();
    if (!res.ok) {
      setError(session?.error || "Failed to create session");
      return;
    }
    setName("");
    await fetchSessions();
    router.push(`/sessions/${session.id}`);
  }

  async function deleteSession(id: string) {
    setError(null);
    setDeleting(id);
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete session");
      }
      await fetchSessions();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-3xl font-semibold">Sessions</h1>

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Session name"
          className="flex-1 rounded border px-3 py-2"
        />
        <button
          onClick={createSession}
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          Create
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded border border-gray-200 p-4">
        {loading ? (
          <p>Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p>No sessions yet. Create one to get started.</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-2">
                <Link
                  href={`/sessions/${session.id}`}
                  className="text-blue-700 underline"
                >
                  {session.name}
                </Link>
                <button
                  className="rounded border border-red-500 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  onClick={() => deleteSession(session.id)}
                  disabled={deleting === session.id}
                >
                  {deleting === session.id ? "Deleting..." : "Delete"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
