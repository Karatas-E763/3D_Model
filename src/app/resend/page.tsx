"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FaEnvelope } from "react-icons/fa";
import Header from "@/components/Sidebar/Header";
import { useAppStore } from "@/store/useAppStore";

function ResendQuoteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vehicleTitle = searchParams.get("vehicle") ?? undefined;
  const quoteItems = useAppStore((s) => s.quoteItems);

  const [email, setEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || quoteItems.length === 0) return;

    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/quote/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          clientName: clientName || undefined,
          vehicleTitle,
          quoteItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al enviar la cotización");
        return;
      }
      setSuccess(data.message ?? "Cotización enviada correctamente");
    } catch {
      setError("Error de conexión al enviar la cotización");
    } finally {
      setSending(false);
    }
  };

  if (quoteItems.length === 0) {
    return (
      <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-center text-sm text-gray-600">
          No hay productos en tu cotización.
        </p>
        <Link
          href="/"
          className="mt-4 block text-center text-sm font-medium text-[#1e88e5] hover:underline"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
      <div className="mb-4 flex items-center gap-2">
        <FaEnvelope className="text-[#1e88e5]" />
        <h1 className="text-sm font-bold uppercase tracking-wide text-[#1a3a5c]">
          Enviar cotización
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Nombre del cliente
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1e88e5] focus:ring-1 focus:ring-[#1e88e5]"
            placeholder="Opcional"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Correo electrónico *
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1e88e5] focus:ring-1 focus:ring-[#1e88e5]"
            placeholder="cliente@empresa.com"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
        )}
        {success && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">{success}</p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={sending}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={sending}
            className="flex-1 rounded-xl bg-[#1e88e5] py-2.5 text-sm font-semibold text-white hover:bg-[#1565c0] disabled:opacity-50"
          >
            {sending ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ResendPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f5f7fa]">
      <Header />
      <main className="flex flex-1 items-center justify-center p-4">
        <Suspense
          fallback={
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1e88e5] border-t-transparent" />
          }
        >
          <ResendQuoteForm />
        </Suspense>
      </main>
    </div>
  );
}
