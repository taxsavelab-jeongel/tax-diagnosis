const ALLOWED_ORIGINS = new Set([
  "https://tax.jeongel.com",
  "https://taxsavelab-jeongel.github.io"
]);

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://tax.jeongel.com",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };
}

function clean(value, max = 80) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function numberText(value) {
  const v = clean(value, 24);
  return /^-?[0-9]+(?:\.[0-9]+)?$/.test(v) ? v : "-";
}

function kstNow() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).format(new Date());
}

function buildMessage(p) {
  const name = clean(p.name, 30);
  const phone = clean(p.phone, 24);
  if (!name || !/^[0-9+()\-\s]{8,24}$/.test(phone)) throw new Error("invalid_contact");

  const company = clean(p.company, 60) || "-";
  const wtime = clean(p.wtime, 40) || "-";
  const strategy = clean(p.strategy, 100) || "-";
  const law = clean(p.law, 120) || "-";
  const grade = clean(p.grade, 80) || "-";
  const score = numberText(p.score);
  const limit = numberText(p.limit);
  const ownReal = numberText(p.ownReal);
  const saving = numberText(p.saving);
  const retained = numberText(p.retained);
  const capital = numberText(p.capital);
  const gaji = numberText(p.gaji);
  const shareRatio = numberText(p.shareRatio);
  const spouse = clean(p.spouse, 30) || "-";
  const giftHistory = clean(p.giftHistory, 30) || "-";
  const treasury = clean(p.treasury, 30) || "-";
  const industry = clean(p.industry, 40) || "-";
  const timeline = clean(p.timeline, 40) || "-";
  const divTax = numberText(p.divTax);
  const dday = numberText(p.dday);
  const urgent = treasury === "예" ? `\n⚠️ 자사주 D-${dday} 임박 — 우선 연락 권장` : "";

  return [
    "📋 새 상담 신청 — 정엘가업승계연구소",
    `🕐 ${kstNow()} (KST)`,
    `👤 ${name} / ${phone} / ${company} / 희망: ${wtime}`,
    "",
    `📊 추천전략: ${strategy}`,
    `   법령: ${law}`,
    `   골든타임: ${grade} (점수 ${score})`,
    `   소각가능액(한도): ${limit}억`,
    `   본인 실현가능액: ${ownReal}억`,
    `   예상 절세액: ${saving}억`,
    "",
    `📝 잉여금 ${retained}억 / 자본금 ${capital}억 / 가지급금 ${gaji}억`,
    `   지분율 ${shareRatio}% / 배우자 ${spouse} / 증여이력 ${giftHistory}`,
    `   자사주 ${treasury} / 업종 ${industry} / 은퇴시점 ${timeline}`,
    "",
    `🧮 소각가능액=MIN(잉여금,자본금)=${limit}억 / 배당세금(누진)=${divTax}억${urgent}`
  ].join("\n");
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    if (request.method === "GET") {
      return new Response(JSON.stringify({ ok: true, service: "jeongel-tax-diagnosis-relay" }), {
        status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
      });
    }
    if (request.method !== "POST" || !ALLOWED_ORIGINS.has(origin)) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden" }), { status: 403, headers: cors(origin) });
    }
    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > 12000) return new Response(JSON.stringify({ ok: false, error: "too_large" }), { status: 413, headers: cors(origin) });

    try {
      const payload = await request.json();
      const text = buildMessage(payload);
      const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error("telegram_rejected");
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors(origin) });
    } catch (error) {
      console.error("relay_error", error?.message || "unknown");
      return new Response(JSON.stringify({ ok: false, error: "relay_failed" }), { status: 502, headers: cors(origin) });
    }
  }
};
