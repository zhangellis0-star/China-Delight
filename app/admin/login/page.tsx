"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Could not sign in.");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-md items-center px-4 py-12">
      <form onSubmit={submit} className="w-full rounded-lg border border-stone-200 bg-white p-6 shadow-warm">
        <p className="font-black uppercase tracking-[0.16em] text-china-red">Admin</p>
        <h1 className="mt-2 text-3xl font-black">Sign in</h1>
        <label className="mt-6 grid gap-2 font-bold">
          Password
          <input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="focus-ring h-12 rounded-md border border-stone-300 px-3" />
        </label>
        {error && <p className="mt-3 rounded-md bg-red-50 p-3 font-bold text-china-red">{error}</p>}
        <button disabled={loading} className="focus-ring mt-5 min-h-12 w-full rounded-md bg-china-red px-5 py-3 font-black text-white disabled:bg-stone-400">
          {loading ? "Signing in..." : "Open dashboard"}
        </button>
      </form>
    </section>
  );
}
