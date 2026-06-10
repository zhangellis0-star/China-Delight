"use client";

import { useState } from "react";

type TestResult = {
  protocol: "http" | "https";
  endpointUrl: string;
  ok: boolean;
  httpStatus?: number | null;
  statusText?: string;
  responseText?: string;
  networkError?: string;
  mixedContentLikely: boolean;
  corsOrCertificateLikely: boolean;
  blockedLikely: boolean;
  startedAt: string;
  finishedAt?: string;
};

const defaultIp = process.env.NEXT_PUBLIC_EPSON_EPOS_IP || "192.168.1.78";

function endpoint(protocol: "http" | "https", ip: string) {
  return `${protocol}://${ip.trim()}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000`;
}

function emptyEposXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">
    </epos-print>
  </s:Body>
</s:Envelope>`;
}

async function testEndpoint(protocol: "http" | "https", ip: string): Promise<TestResult> {
  const endpointUrl = endpoint(protocol, ip);
  const mixedContentLikely = typeof window !== "undefined" && window.location.protocol === "https:" && protocol === "http";
  const startedAt = new Date().toISOString();
  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8" },
      body: emptyEposXml()
    });
    const responseText = await response.text().catch(() => "");
    return {
      protocol,
      endpointUrl,
      ok: response.ok,
      httpStatus: response.status,
      statusText: response.statusText,
      responseText,
      mixedContentLikely,
      corsOrCertificateLikely: false,
      blockedLikely: false,
      startedAt,
      finishedAt: new Date().toISOString()
    };
  } catch (error) {
    const networkError = error instanceof Error ? error.message : "Unknown browser fetch error";
    const blockedLikely = /load failed|failed to fetch|blocked|networkerror|cors|certificate|ssl|tls/i.test(networkError);
    return {
      protocol,
      endpointUrl,
      ok: false,
      httpStatus: null,
      responseText: "",
      networkError,
      mixedContentLikely,
      corsOrCertificateLikely: protocol === "https" && blockedLikely,
      blockedLikely: blockedLikely || mixedContentLikely,
      startedAt,
      finishedAt: new Date().toISOString()
    };
  }
}

export function PrinterEndpointTest() {
  const [ip, setIp] = useState(defaultIp);
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  async function runTests() {
    setTesting(true);
    setResults([]);
    try {
      const next = [];
      next.push(await testEndpoint("http", ip));
      setResults([...next]);
      next.push(await testEndpoint("https", ip));
      setResults([...next]);
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-lg border border-china-gold/60 bg-[#fff7e8] p-5 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.14em] text-china-red">Printer Endpoint Test</p>
        <h1 className="mt-2 text-3xl font-black text-stone-950">Epson TM-m30III ePOS diagnostics</h1>
        <p className="mt-2 font-bold text-stone-700">
          This checks the printer from this browser. It does not use AirPrint or Bluetooth. The empty ePOS request should not print a ticket.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="grid gap-1">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-china-red">Printer IP</span>
            <input value={ip} onChange={(event) => setIp(event.target.value)} className="focus-ring h-12 rounded-md border border-china-gold/70 bg-white px-3 text-lg font-bold" />
          </label>
          <button onClick={runTests} disabled={testing || !ip.trim()} className="focus-ring min-h-12 self-end rounded-md bg-china-red px-5 font-black text-white disabled:bg-stone-400">
            {testing ? "Testing..." : "Test HTTP + HTTPS"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        {results.map((result) => (
          <article key={result.protocol} className={`rounded-lg border p-4 shadow-sm ${result.ok ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-black uppercase">{result.protocol} test</h2>
              <span className={`rounded-md px-3 py-1 text-sm font-black ${result.ok ? "bg-green-100 text-green-900" : "bg-amber-100 text-amber-950"}`}>
                {result.ok ? "Success" : "Failed / Blocked"}
              </span>
            </div>
            <div className="mt-3 grid gap-2 font-mono text-sm">
              <p className="break-all">endpoint URL: {result.endpointUrl}</p>
              <p>HTTP status: {result.httpStatus ?? "n/a"} {result.statusText ?? ""}</p>
              <p>mixed-content failure likely: {result.mixedContentLikely ? "yes" : "no"}</p>
              <p>CORS/certificate failure likely: {result.corsOrCertificateLikely ? "yes" : "no"}</p>
              <p>request blocked likely: {result.blockedLikely ? "yes" : "no"}</p>
              <p className="whitespace-pre-wrap break-words">network error: {result.networkError || "none"}</p>
              <p className="whitespace-pre-wrap break-words">response text: {result.responseText || "none"}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 rounded-lg border border-china-gold/60 bg-white p-4 text-sm font-bold text-stone-700">
        <p className="font-black text-china-red">How to read this</p>
        <p className="mt-2">On the deployed HTTPS admin, HTTP usually fails because browsers block mixed content.</p>
        <p className="mt-1">If HTTPS fails with Load failed, Safari probably does not trust the printer&apos;s self-signed certificate yet, or the printer is not serving ePOS over HTTPS.</p>
        <p className="mt-1">Try opening <code className="font-mono">https://{ip}/cgi-bin/epos/service.cgi</code> directly in Safari and accepting/trusting the certificate if Safari allows it.</p>
      </div>
    </section>
  );
}
