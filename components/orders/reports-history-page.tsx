"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Printer, RefreshCw } from "lucide-react";
import { formatPrice } from "@/lib/pricing";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/types";

type DailyReportSummaryView = {
  totalOrders: number;
  cancelledOrders: number;
  foodSales: number;
  discounts: number;
  tax: number;
  processingFees: number;
  tips: number;
  cashTotal: number;
  stripeTotal: number;
  grandTotal: number;
};

type DailyReportDetail = {
  date: string;
  dateLabel: string;
  testOrdersExcluded: number;
  summary: DailyReportSummaryView;
  orders: Array<{
    orderNumber: string;
    createdAt: string | null;
    timeLabel: string;
    customerName: string;
    customerPhone: string;
    status: OrderStatus;
    paymentMethod: PaymentMethod | string;
    paymentStatus?: PaymentStatus | null;
    subtotal: number;
    tax: number;
    processingFee: number;
    tip: number;
    discount: number;
    total: number;
    itemsSummary: string;
  }>;
};

type DailyReportRecent = Pick<DailyReportDetail, "date" | "dateLabel" | "testOrdersExcluded" | "summary">;

function easternDateKey(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value);
}

function paymentLabel(method?: PaymentMethod | string, status?: PaymentStatus | null) {
  if (method !== "stripe") return "Pay at pickup";
  if (status === "paid") return "Stripe paid";
  if (status === "failed") return "Stripe failed";
  if (status === "refunded") return "Stripe refunded";
  return "Stripe pending";
}

function statusLabel(status: OrderStatus) {
  if (status === "picked_up") return "Picked up";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadReportCsv(report: DailyReportDetail) {
  const rows = [
    ["Order number", "Time", "Customer", "Phone", "Status", "Payment", "Subtotal", "Discount", "Tax", "Processing fee", "Tip", "Total", "Items"],
    ...report.orders.map((order) => [
      order.orderNumber,
      order.timeLabel,
      order.customerName,
      order.customerPhone,
      statusLabel(order.status),
      paymentLabel(order.paymentMethod, order.paymentStatus),
      order.subtotal,
      order.discount,
      order.tax,
      order.processingFee,
      order.tip,
      order.total,
      order.itemsSummary
    ])
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `china-delight-report-${report.date}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportsHistoryPage() {
  const [selectedDate, setSelectedDate] = useState(easternDateKey());
  const [days, setDays] = useState("30");
  const [report, setReport] = useState<DailyReportDetail | null>(null);
  const [recentReports, setRecentReports] = useState<DailyReportRecent[]>([]);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedReports = useMemo(
    () => [...recentReports].sort((left, right) => right.date.localeCompare(left.date)),
    [recentReports]
  );

  const loadReport = useCallback(async (date = selectedDate) => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/daily-report?date=${encodeURIComponent(date)}&days=${encodeURIComponent(days)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load reports history.");
      setReport(data.report ?? null);
      setRecentReports(data.recentReports ?? []);
      setSelectedDate(data.report?.date ?? date);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load reports history.");
    } finally {
      setLoading(false);
    }
  }, [days, selectedDate]);

  useEffect(() => {
    void loadReport(selectedDate);
  }, []);

  async function printReport() {
    if (!report) return;
    setPrinting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: report.date })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not print report.");
      setMessage(`Report printed for ${report.dateLabel}.`);
    } catch (printError) {
      setError(printError instanceof Error ? printError.message : "Could not print report.");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <section className="admin-shell mobile-safe mx-auto max-w-7xl bg-[linear-gradient(180deg,#fff7e8,#f4fbfb)] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-china-red">Admin</p>
          <h1 className="break-words text-2xl font-black sm:text-3xl">Reports History</h1>
          <p className="mt-1 text-sm font-bold text-stone-600">Review, export, and reprint generated daily reports from existing order history.</p>
        </div>
        <Link href="/admin" className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-md border border-china-gold/70 bg-white px-4 text-sm font-black text-stone-800">
          <ArrowLeft className="h-4 w-4" />
          Back to admin
        </Link>
      </div>

      <div className="mt-5 min-w-0 rounded-lg border border-china-gold/60 bg-[#fff7e8] p-3 shadow-sm sm:p-4">
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,auto)] lg:items-end">
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,12rem)_minmax(0,1fr)]">
            <label className="grid gap-1 text-xs font-black text-stone-700">
              Report date
              <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="focus-ring h-11 rounded-md border border-china-gold/70 bg-white px-3 font-bold" />
            </label>
            <label className="grid gap-1 text-xs font-black text-stone-700">
              Recent range
              <select value={days} onChange={(event) => setDays(event.target.value)} className="focus-ring h-11 rounded-md border border-china-gold/70 bg-white px-3 font-bold">
                <option value="7">Last 7 days</option>
                <option value="14">Last 14 days</option>
                <option value="30">Last 30 days</option>
              </select>
            </label>
            <button onClick={() => loadReport(selectedDate)} disabled={loading} className="focus-ring min-h-11 self-end rounded-md bg-china-red px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-stone-400">
              {loading ? "Loading..." : "View report"}
            </button>
          </div>
          <div className="flex max-w-full flex-wrap gap-2">
            <button onClick={() => loadReport(selectedDate)} disabled={loading} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-md border border-china-gold/70 bg-white px-3 text-sm font-black text-stone-800 disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button onClick={() => report && downloadReportCsv(report)} disabled={!report || report.orders.length === 0} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-md border border-china-gold/70 bg-white px-3 text-sm font-black text-stone-800 disabled:cursor-not-allowed disabled:opacity-50">
              <Download className="h-4 w-4" />
              Download CSV
            </button>
            <button onClick={printReport} disabled={!report || printing} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-md border border-china-gold/70 bg-white px-3 text-sm font-black text-stone-800 disabled:cursor-not-allowed disabled:opacity-50">
              <Printer className="h-4 w-4" />
              {printing ? "Printing..." : "Print"}
            </button>
          </div>
        </div>
        {error && <p className="mt-3 rounded-md bg-amber-100 px-3 py-2 text-sm font-bold text-amber-900">{error}</p>}
        {message && <p className="mt-3 rounded-md bg-green-100 px-3 py-2 text-sm font-bold text-green-800">{message}</p>}
      </div>

      <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="min-w-0 rounded-lg border border-china-gold/60 bg-white p-3 shadow-sm sm:p-4">
          <p className="font-black text-china-red">Recent reports</p>
          <div className="mt-3 grid gap-2">
            {sortedReports.length === 0 && !loading ? (
              <p className="rounded-md border border-dashed border-china-gold/60 bg-[#fff7e8] p-4 text-center text-sm font-bold text-stone-600">No reports found yet.</p>
            ) : (
              sortedReports.map((item) => (
                <button
                  key={item.date}
                  onClick={() => loadReport(item.date)}
                  className={`focus-ring rounded-md border p-3 text-left text-sm ${
                    report?.date === item.date ? "border-china-red bg-red-50" : "border-china-gold/50 bg-white hover:bg-china-paper"
                  }`}
                >
                  <span className="block font-black text-stone-900">{item.dateLabel}</span>
                  <span className="mt-1 block text-xs font-bold text-stone-600">{item.summary.totalOrders} orders / {formatPrice(item.summary.grandTotal)}</span>
                  <span className="mt-0.5 block text-[11px] font-bold text-stone-500">{item.testOrdersExcluded} test excluded</span>
                </button>
              ))
            )}
          </div>
        </aside>

        <div className="grid min-w-0 gap-4">
          {report ? (
            <>
              <div className="min-w-0 rounded-lg border border-china-gold/60 bg-white p-3 shadow-sm sm:p-4">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-china-red">Selected report</p>
                    <h2 className="text-xl font-black">{report.dateLabel}</h2>
                    <p className="text-xs font-bold text-stone-600">Generated on demand from saved orders. {report.testOrdersExcluded} test order{report.testOrdersExcluded === 1 ? "" : "s"} excluded.</p>
                  </div>
                  <p className="rounded-md bg-china-paper px-3 py-2 text-xs font-black text-stone-700">Date: {report.date}</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold sm:grid-cols-3 lg:grid-cols-5">
                  {[
                    ["Total orders", report.summary.totalOrders],
                    ["Cancelled", report.summary.cancelledOrders],
                    ["Total sales", formatPrice(report.summary.grandTotal)],
                    ["Food sales", formatPrice(report.summary.foodSales)],
                    ["Discounts", formatPrice(report.summary.discounts)],
                    ["Tax", formatPrice(report.summary.tax)],
                    ["Tips", formatPrice(report.summary.tips)],
                    ["Processing", formatPrice(report.summary.processingFees)],
                    ["Cash/pay pickup", formatPrice(report.summary.cashTotal)],
                    ["Online/paid", formatPrice(report.summary.stripeTotal)]
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md border border-china-gold/40 bg-[#fff7e8] p-3">
                      <p className="uppercase tracking-wide text-china-red">{label}</p>
                      <p className="mt-1 text-base font-black text-stone-900">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="min-w-0 rounded-lg border border-china-gold/60 bg-white p-3 shadow-sm sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black text-china-red">Report details</p>
                  <p className="text-xs font-bold text-stone-600">{report.orders.length} real order{report.orders.length === 1 ? "" : "s"}</p>
                </div>
                <div className="mt-3 grid gap-2">
                  {report.orders.length === 0 ? (
                    <p className="rounded-md border border-dashed border-china-gold/60 bg-[#fff7e8] p-5 text-center font-bold text-stone-600">No reports found yet for this date.</p>
                  ) : (
                    report.orders.map((order) => (
                      <article key={order.orderNumber} className="rounded-md border border-china-gold/40 bg-[#fff7e8] p-3">
                        <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)] sm:items-start">
                          <div className="min-w-0">
                            <p className="font-black text-china-red">#{order.orderNumber} <span className="text-stone-900">{order.timeLabel}</span></p>
                            <p className="break-words text-sm font-bold text-stone-800">{order.customerName} / {order.customerPhone}</p>
                            <p className="text-xs font-bold text-stone-600">{paymentLabel(order.paymentMethod, order.paymentStatus)} / {statusLabel(order.status)}</p>
                          </div>
                          <p className="text-right text-lg font-black">{formatPrice(order.total)}</p>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-stone-700">
                          <span>Subtotal {formatPrice(order.subtotal)}</span>
                          {order.discount > 0 && <span className="text-china-red">Discount -{formatPrice(order.discount)}</span>}
                          <span>Tax {formatPrice(order.tax)}</span>
                          <span>Tip {formatPrice(order.tip)}</span>
                        </div>
                        {order.itemsSummary && <p className="mt-2 break-words text-xs font-bold text-stone-600">{order.itemsSummary}</p>}
                      </article>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-china-gold/60 bg-white p-8 text-center shadow-sm">
              <p className="font-black text-china-red">No reports found yet</p>
              <p className="mt-1 text-sm font-bold text-stone-600">Choose a date or refresh the recent reports list.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
