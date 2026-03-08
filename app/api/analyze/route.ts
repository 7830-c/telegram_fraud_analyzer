import { NextRequest, NextResponse } from "next/server";

const TINYFISH_URL = "https://agent.tinyfish.ai/v1/automation/run-sse";

function buildGoal(channelUrl: string): string {
  return `You are a Telegram Fraud Detection Agent. Open this Telegram channel URL and produce a structured Fraud Risk Report.

CHANNEL URL: ${channelUrl}

Workflow:

1. Open Telegram Web with the given channel URL.
   - Extract visible metadata: channel_name, description, member_count, verification_status, profile_photo_present, and any visible links.

2. If a "Preview Channel" button is available:
   - Click it. If it opens, analyze the last 200 messages:
     • Check text for red flags (investment promises, fake giveaways, requests for money/keys, impersonation, spam).
     • Collect and analyze all links in messages.
     • Mark links safe if they lead to trusted websites with proper HTTPS and valid SSL certificates.
     • Mark the channel fraudulent if links redirect to suspicious or unsafe sites.
   - If the preview button does not work and instead prompts to open Telegram or sign in, stop processing messages.
     • Base findings only on metadata and visible links.

3. Regardless of preview availability, always search the web for any news or articles related to the channel name or metadata.
   - If scam alerts, fraud warnings, or negative reports are found, mark the channel unsafe.
   - If coverage is positive or neutral, include that in the evidence.

4. Admin identity:
   - If visible, record admin username or name and cross-check across other platforms.
   - If not visible, set admin_visible: false.

5. Wallet addresses:
   - Extract only if visible (e.g., 0x..., BTC, Solana).

6. Evidence:
   - Compile a list of findings that support the risk score (e.g., "Channel verified", "Outbound links safe", "Scam reports found online").

7. Fraud Risk Score:
   - Start at 50 baseline.
   - Add points for positive signals:
     • +20 verified channel
     • +15 realistic subscriber count
     • +15 normal messages
     • +20 safe outbound links
     • +10 admin identity confirmed
     • +10 no scam reports
   - Subtract points for negative signals:
     • −30 scam red flags in messages
     • −25 suspicious/phishing links
     • −20 hidden/impersonated admin
     • −20 wallet addresses found
     • −25 scam reports online
     • −10 incomplete metadata
   - Interpret score:
     • 70–100 = legitimate
     • 40–69 = suspicious
     • 0–39 = likely_fraud

Return ONLY a single JSON object (no markdown, no code block):

{
  "channel_metadata": { "channel_name": "", "description": null, "member_count": null, "verification_status": null, "profile_photo_present": false },
  "message_analysis": { "message_red_flags": [], "message_summary": "" },
  "outbound_links": [],
  "admin_cross_check": { "admin_visible": false, "admin_username_or_name": null, "cross_platform_match": null },
  "wallet_addresses": [],
  "evidence": [],
  "fraud_risk_score": 0,
  "conclusion": "legitimate"
}`;
}

function normalizeChannelUrl(input: string): string {
  const s = input.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("t.me/")) return `https://${s}`;
  if (s.startsWith("telegram.dog/")) return `https://${s}`;
  return `https://t.me/${s.replace(/^@/, "")}`;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TINYFISH_API_KEY is not set. Add it to .env.local." },
      { status: 500 }
    );
  }

  let body: { channelUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body. Send { channelUrl: string }." },
      { status: 400 }
    );
  }

  const channelUrl = body.channelUrl;
  if (!channelUrl || typeof channelUrl !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid channelUrl." },
      { status: 400 }
    );
  }

  const url = normalizeChannelUrl(channelUrl);

  const goal = buildGoal(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 min

  try {
    const res = await fetch(TINYFISH_URL, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        goal,
        browser_profile: "stealth",
      }),
      signal: controller.signal,
      // @ts-expect-error Next.js / Node fetch may support duplex for streaming
      duplex: "half",
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `TinyFish API error: ${res.status}`, details: text },
        { status: 502 }
      );
    }

    const contentType = res.headers.get("content-type") || "text/event-stream";
    return new Response(res.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    clearTimeout(timeout);
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: "Analysis request failed", details: message },
      { status: 502 }
    );
  }
}
