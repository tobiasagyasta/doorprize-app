"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [name, setName] = useState("");
  const router = useRouter();

  async function createSession() {
    const res = await fetch("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ name }),
      headers: { "Content-Type": "application/json" },
    });
    const session = await res.json();
    router.push(`/sessions/${session.id}`);
  }

  return (
    <main>
      <h1>Create Session</h1>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={createSession}>Create</button>
    </main>
  );
}
