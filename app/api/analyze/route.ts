import { NextRequest, NextResponse } from "next/server";

const TINYFISH_URL = "https://agent.tinyfish.ai/v1/automation/run-sse";

function buildGoal(channelUrl: string): string {
  return `You are a Telegram Fraud Detection Agent. Open this Telegram channel URL and produce a structured Fraud Risk Report.

CHANNEL URL: ${channelUrl}

IMPORTANT – Telegram web behavior:
Many t.me pages show only "Open in Telegram" or "View in Telegram" and do NOT show message content without signing in. Do NOT get stuck waiting for messages to appear. If the page shows a prompt to open Telegram, or asks to sign in, or you do not see a list of channel messages within a few seconds:
- Extract ONLY what is visible: channel name, description, subscriber count, profile photo, any visible buttons or links.
- Set message_analysis.message_summary to: "No message preview available on web (Open in Telegram / sign-in required). Analysis based on channel metadata and visible elements only."
- Set message_analysis.message_red_flags to [].
- Then proceed to steps 3–7 below using only the visible metadata and any links on the page. Do not wait or retry for message content.

Steps:

1. Open the channel page. Extract whatever is visible (even if it's just the "Open in Telegram" screen):
   - channel_name, description, member_count (or subscriber count if shown), verification_status, profile_photo_present, any_other_metadata.

2. Messages (only if you actually see channel messages on the page):
   - If you see message content: analyze for red flags (urgency, investment promises, requests for funds/keys, fake giveaways, impersonation, spam). Fill message_red_flags and message_summary.
   - If you do NOT see messages (only "Open in Telegram" or similar): set message_summary to the text above and message_red_flags to []. Do not wait; move on.

3. Outbound links: from the current page, collect any clickable links (buttons, "Open in Telegram", or links in visible text). For each real external URL (not t.me or telegram.dog), optionally visit it and set label "safe" | "suspicious" | "phishing" with reason. If no external links are visible, return outbound_links: [].

4. Admin: if admin/creator name or username is visible, report in admin_cross_check. Optionally search another platform for that identity. If nothing visible, set admin_visible: false.

5. Wallet addresses: only if you see any (e.g. 0x..., Bitcoin, Solana) in visible text. If no messages are visible, wallet_addresses: [].

6. evidence: list of findings that support the score (e.g. "Channel has description and subscriber count", "No message preview available", "No suspicious links visible").

7. fraud_risk_score (0–100) and conclusion ("legitimate" | "suspicious" | "likely_fraud") based only on what you could see. If you had no message access, score should reflect limited data (e.g. lower confidence).

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
