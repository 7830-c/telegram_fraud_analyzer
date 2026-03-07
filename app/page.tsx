"use client";

import { useState, useCallback, useRef } from "react";
import type { FraudReport } from "./types";

type Status = "idle" | "running" | "done" | "error" | "cancelled";

interface ProgressItem {
  id: number;
  text: string;
  type: "progress" | "started" | "url" | "complete";
}

export default function Home() {
  const [channelUrl, setChannelUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [report, setReport] = useState<FraudReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamingUrl, setStreamingUrl] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const progressIdRef = { current: 0 };
  const abortControllerRef = useRef<AbortController | null>(null);
  const runIdRef = useRef<string | null>(null);

  const stopAnalysis = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const id = runIdRef.current || runId;
    if (id) {
      try {
        await fetch("/api/analyze/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId: id }),
        });
      } catch {
        // ignore cancel API errors
      }
    }
    setError("Analysis stopped by you.");
    setStatus("cancelled");
  }, [runId]);

  const runAnalysis = useCallback(async () => {
    const url = channelUrl.trim();
    if (!url) return;
    setStatus("running");
    setProgress([]);
    setReport(null);
    setError(null);
    setStreamingUrl(null);
    setRunId(null);
    runIdRef.current = null;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const addProgress = (text: string, type: ProgressItem["type"] = "progress") => {
      progressIdRef.current += 1;
      setProgress((prev) => [...prev, { id: progressIdRef.current, text, type }]);
    };

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelUrl: url }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.details || `Request failed: ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      addProgress("Connected. Starting analysis…", "started");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]" || payload === "") continue;
          try {
            const event = JSON.parse(payload);
            if (event.type === "STARTED") {
              if (event.runId) {
                runIdRef.current = event.runId;
                setRunId(event.runId);
              }
              addProgress("Browser session started.", "started");
            } else if (event.type === "STREAMING_URL" && event.streamingUrl) {
              setStreamingUrl(event.streamingUrl);
              addProgress("Live view available.", "url");
            } else if (event.type === "PROGRESS") {
              const purpose = event.purpose || event.message || "Working…";
              addProgress(purpose, "progress");
            } else if (event.type === "COMPLETE") {
              if (event.status === "COMPLETED") {
                let result = event.resultJson;
                if (typeof result === "string") {
                  try {
                    result = JSON.parse(result);
                  } catch {
                    result = { raw: result };
                  }
                }
                setReport(result as FraudReport);
                addProgress("Analysis complete.", "complete");
                setStatus("done");
              } else {
                const errMsg = event.error?.message || event.status || "Unknown error";
                throw new Error(errMsg);
              }
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Analysis stopped by you.");
        setStatus("cancelled");
        return;
      }
      setError(err instanceof Error ? err.message : "Analysis failed");
      setStatus("error");
    } finally {
      abortControllerRef.current = null;
    }
  }, [channelUrl]);

  const conclusionLabel = (c?: string) => {
    switch (c) {
      case "legitimate": return "Legitimate";
      case "suspicious": return "Suspicious";
      case "likely_fraud": return "Likely fraud";
      default: return c || "—";
    }
  };

  const conclusionColor = (c?: string) => {
    switch (c) {
      case "legitimate": return "text-accent";
      case "suspicious": return "text-warn";
      case "likely_fraud": return "text-danger";
      default: return "text-muted";
    }
  };

  const scoreColor = (n?: number) => {
    if (n == null) return "text-muted";
    if (n <= 30) return "text-accent";
    if (n <= 60) return "text-warn";
    return "text-danger";
  };

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-8 md:py-12">
      <div className="w-full max-w-6xl flex-1 flex flex-col">
        <header className="text-center mb-8 md:mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-4 py-1.5 mb-4 opacity-0 animate-fade-up [animation-fill-mode:forwards] [animation-delay:100ms]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <span className="text-xs font-medium text-accent uppercase tracking-wider">TinyFish powered</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white drop-shadow-sm opacity-0 animate-fade-up [animation-fill-mode:forwards] [animation-delay:200ms]">
            <span className="bg-gradient-to-r from-white via-zinc-200 to-accent bg-clip-text text-transparent">Telegram Fraud</span>
            <br />
            <span className="text-accent">Analyzer</span>
          </h1>
          <p className="text-zinc-400 mt-4 text-sm md:text-base max-w-lg mx-auto opacity-0 animate-fade-up [animation-fill-mode:forwards] [animation-delay:350ms]">
            Enter a channel link. We’ll check metadata, messages, links, admins, and wallets—with a <span className="text-accent">live view</span> of the analysis.
          </p>
          <p className="text-zinc-500 mt-2 text-xs max-w-md mx-auto opacity-0 animate-fade-up [animation-fill-mode:forwards] [animation-delay:450ms]">
            Many t.me pages show only &quot;Open in Telegram&quot; and no message preview. In those cases the report is based on channel metadata and visible elements only.
          </p>
        </header>

        <div className="gradient-border rounded-2xl p-6 md:p-8 mb-8 shadow-xl shadow-black/20 card-hover opacity-0 animate-scale-in [animation-fill-mode:forwards] [animation-delay:550ms]">
          <label className="block text-sm font-medium text-zinc-400 mb-2">
            Channel URL or username
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="https://t.me/channel or @channel"
              value={channelUrl}
              onChange={(e) => setChannelUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAnalysis()}
              className="flex-1 rounded-xl bg-void border border-border px-4 py-3.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition duration-200"
              disabled={status === "running"}
            />
            <button
              onClick={runAnalysis}
              disabled={status === "running" || !channelUrl.trim()}
              className="rounded-xl bg-accent hover:bg-accentDim text-void font-semibold px-8 py-3.5 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-lg shadow-accent/25 hover:shadow-accent/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              {status === "running" ? "Analyzing…" : "Analyze"}
            </button>
          </div>
        </div>

        {status === "running" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 animate-fade-in">
            <div className="lg:col-span-5 gradient-border rounded-2xl p-6 shadow-xl shadow-black/20 card-hover">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
                  Live progress
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 font-mono">{progress.length} steps</span>
                  <button
                    type="button"
                    onClick={stopAnalysis}
                    className="rounded-lg border border-danger/60 bg-danger/10 text-danger hover:bg-danger/20 px-3 py-1.5 text-sm font-medium transition flex items-center gap-1.5"
                  >
                    <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="1" />
                    </svg>
                    Stop analysis
                  </button>
                </div>
              </div>
              <div className="relative progress-timeline pl-8 pr-2">
                <ul className="space-y-0 max-h-[320px] overflow-y-auto pb-2">
                  {progress.map((item, i) => (
                    <li
                      key={item.id}
                      className="relative flex items-start gap-3 py-3 animate-slide-in"
                      style={{ animationDelay: `${i * 30}ms` }}
                    >
                      <span className="absolute left-[-1.6rem] top-5 flex h-6 w-6 items-center justify-center rounded-full bg-surface border-2 border-accent/50 text-accent">
                        {item.type === "started" && (
                          <svg className="h-3 w-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        )}
                        {item.type === "url" && (
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        )}
                        {item.type === "progress" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                        )}
                        {item.type === "complete" && (
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        )}
                      </span>
                      <p className="text-sm text-zinc-300 leading-snug pt-0.5">{item.text}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col">
              {streamingUrl ? (
                <div className="live-preview-wrap rounded-2xl overflow-hidden flex-1 flex flex-col min-h-[320px] animate-fade-in">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-black/30">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                      </span>
                      <span className="text-xs font-medium text-zinc-400">Live browser</span>
                    </div>
                    <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                      Live
                    </span>
                  </div>
                  <div className="flex-1 min-h-[280px] relative">
                    <iframe
                      src={streamingUrl}
                      title="Live analysis view"
                      className="absolute inset-0 w-full h-full rounded-b-2xl border-0 bg-zinc-900"
                      sandbox="allow-scripts allow-same-origin"
                    />
                  </div>
                </div>
              ) : (
                <div className="gradient-border rounded-2xl overflow-hidden flex-1 flex flex-col min-h-[320px] items-center justify-center p-8 text-center">
                  <div className="w-12 h-12 rounded-full border-2 border-accent/30 border-t-accent animate-spin mb-4" />
                  <p className="text-sm text-zinc-500">Starting live browser view…</p>
                  <p className="text-xs text-zinc-600 mt-1">Preview will appear here shortly</p>
                </div>
              )}
            </div>
          </div>
        )}

        {(status === "error" || status === "cancelled") && error && (
          <div className={`rounded-2xl border p-6 mb-8 ${
            status === "cancelled"
              ? "border-warn/50 bg-warn/10 text-warn"
              : "border-danger/50 bg-danger/10 text-danger"
          }`}>
            <p className="font-medium">{status === "cancelled" ? "Stopped" : "Error"}</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {status === "done" && report && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="gradient-border rounded-2xl p-8 shadow-xl shadow-black/20 card-hover animate-scale-in">
              <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Verdict</h2>
              <div className="flex flex-wrap items-baseline gap-6">
                <span className={`text-3xl font-bold ${conclusionColor(report.conclusion)}`}>
                  {conclusionLabel(report.conclusion)}
                </span>
                {report.fraud_risk_score != null && (
                  <span className={`text-2xl font-mono font-semibold ${scoreColor(report.fraud_risk_score)}`}>
                    Score: {report.fraud_risk_score}/100
                  </span>
                )}
              </div>
            </div>

            {report.channel_metadata && (
              <div className="gradient-border rounded-2xl p-6 shadow-lg shadow-black/10 card-hover opacity-0 animate-fade-up [animation-fill-mode:forwards]" style={{ animationDelay: "0ms" }}>
                <h2 className="text-lg font-semibold text-white mb-3">Channel metadata</h2>
                <dl className="grid gap-2 text-sm">
                  <MetaRow label="Name" value={report.channel_metadata.channel_name} />
                  <MetaRow label="Description" value={report.channel_metadata.description} />
                  <MetaRow label="Members" value={report.channel_metadata.member_count} />
                  <MetaRow label="Verification" value={report.channel_metadata.verification_status} />
                </dl>
              </div>
            )}

            {report.message_analysis && (
              <div className="gradient-border rounded-2xl p-6 shadow-lg shadow-black/10 card-hover opacity-0 animate-fade-up [animation-fill-mode:forwards]" style={{ animationDelay: "80ms" }}>
                <h2 className="text-lg font-semibold text-white mb-3">Message analysis</h2>
                {report.message_analysis.message_summary && (
                  <p className="text-zinc-400 text-sm mb-3">{report.message_analysis.message_summary}</p>
                )}
                {report.message_analysis.message_red_flags?.length ? (
                  <ul className="list-disc list-inside text-sm text-warn space-y-1">
                    {report.message_analysis.message_red_flags.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-zinc-500 text-sm">No red flags reported.</p>
                )}
              </div>
            )}

            {report.outbound_links && report.outbound_links.length > 0 && (
              <div className="gradient-border rounded-2xl p-6 shadow-lg shadow-black/10 card-hover opacity-0 animate-fade-up [animation-fill-mode:forwards]" style={{ animationDelay: "160ms" }}>
                <h2 className="text-lg font-semibold text-white mb-3">Outbound links</h2>
                <ul className="space-y-2">
                  {report.outbound_links.map((l, i) => (
                    <li key={i} className="text-sm flex flex-wrap items-center gap-2">
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${
                          l.label === "safe"
                            ? "bg-accent/20 text-accent"
                            : l.label === "suspicious"
                            ? "bg-warn/20 text-warn"
                            : "bg-danger/20 text-danger"
                        }`}
                      >
                        {l.label}
                      </span>
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent truncate max-w-[280px] hover:underline"
                      >
                        {l.url}
                      </a>
                      {l.reason && <span className="text-zinc-500">— {l.reason}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {report.admin_cross_check && (
              <div className="gradient-border rounded-2xl p-6 shadow-lg shadow-black/10 card-hover opacity-0 animate-fade-up [animation-fill-mode:forwards]" style={{ animationDelay: "240ms" }}>
                <h2 className="text-lg font-semibold text-white mb-3">Admin cross-check</h2>
                <dl className="grid gap-2 text-sm">
                  <MetaRow label="Admin visible" value={report.admin_cross_check.admin_visible} />
                  <MetaRow label="Username / name" value={report.admin_cross_check.admin_username_or_name} />
                  <MetaRow label="Cross-platform match" value={report.admin_cross_check.cross_platform_match} />
                </dl>
              </div>
            )}

            {report.wallet_addresses && report.wallet_addresses.length > 0 && (
              <div className="gradient-border rounded-2xl p-6 shadow-lg shadow-black/10 card-hover opacity-0 animate-fade-up [animation-fill-mode:forwards]" style={{ animationDelay: "320ms" }}>
                <h2 className="text-lg font-semibold text-white mb-3">Wallet addresses</h2>
                <ul className="space-y-2">
                  {report.wallet_addresses.map((w, i) => (
                    <li key={i} className="text-sm flex flex-wrap items-center gap-2">
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${
                          w.risk === "low" ? "bg-accent/20 text-accent" : w.risk === "medium" ? "bg-warn/20 text-warn" : "bg-danger/20 text-danger"
                        }`}
                      >
                        {w.risk}
                      </span>
                      <span className="font-mono text-zinc-300">{w.address}</span>
                      {w.reason && <span className="text-zinc-500">— {w.reason}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {report.evidence && report.evidence.length > 0 && (
              <div className="gradient-border rounded-2xl p-6 shadow-lg shadow-black/10 card-hover opacity-0 animate-fade-up [animation-fill-mode:forwards]" style={{ animationDelay: "400ms" }}>
                <h2 className="text-lg font-semibold text-white mb-3">Evidence</h2>
                <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
                  {report.evidence.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <footer className="mt-auto w-full pt-16 pb-8">
          <div className="footer-gradient mb-12" />
          <div className="max-w-4xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
              <div>
                <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">What it does</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Telegram Fraud Analyzer uses AI to visit any Telegram channel, read metadata and visible content, follow outbound links, and cross-check admins. It detects wallet addresses and compiles a clear fraud risk report so you can spot scams before engaging.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">Features</h3>
                <ul className="text-zinc-400 text-sm space-y-2">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                    Channel metadata & verification
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                    Message & link analysis
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                    Live browser view of the run
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                    Wallet address risk flags
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                    Stop analysis anytime
                  </li>
                </ul>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
              <p>
                Built for the <a href="https://www.hackerearth.com/challenges/hackathon/the-tiny-fish-hackathon-2026/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">TinyFish $2M Pre-Accelerator Hackathon</a>
              </p>
              <p>
                Powered by <a href="https://docs.tinyfish.ai" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">TinyFish Web Agent</a>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: unknown }) {
  const v = value === undefined || value === null ? "—" : String(value);
  return (
    <div className="flex gap-2">
      <dt className="text-zinc-500 shrink-0">{label}:</dt>
      <dd className="text-zinc-300 break-words">{v}</dd>
    </div>
  );
}
