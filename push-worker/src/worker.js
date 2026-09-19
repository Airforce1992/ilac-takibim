import webpush from "web-push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://airforce1992.github.io",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=UTF-8" },
  });
}

function getLocalParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`,
  };
}

async function sendPush(env, subscription, payload) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  return webpush.sendNotification(subscription, JSON.stringify(payload));
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true, service: "İlaç Takibim Push", message: "Bildirim sunucusu çalışıyor" });
    }

    if (url.pathname === "/vapid-public-key") {
      return json({ publicKey: env.VAPID_PUBLIC_KEY });
    }

    if (url.pathname === "/subscribe" && request.method === "POST") {
      const subscription = await request.json();
      if (!subscription?.endpoint) return json({ ok: false, error: "Geçersiz abonelik" }, 400);
      await env.PUSH_KV.put("subscription", JSON.stringify(subscription));
      return json({ ok: true });
    }

    if (url.pathname === "/schedule" && request.method === "POST") {
      const body = await request.json();
      const timeZone = String(body?.timeZone || "Europe/Istanbul");
      const meds = Array.isArray(body?.meds) ? body.meds
        .filter(m => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(m?.time || "")) && String(m?.name || "").trim())
        .map(m => ({ time: String(m.time), name: String(m.name).trim().slice(0, 120) })) : [];
      await env.PUSH_KV.put("schedule", JSON.stringify({ timeZone, meds, updatedAt: Date.now() }));
      return json({ ok: true, count: meds.length });
    }

    if (url.pathname === "/test" && request.method === "POST") {
      const raw = await env.PUSH_KV.get("subscription");
      if (!raw) return json({ ok: false, error: "Önce iPhone aboneliği gerekli" }, 404);

      const subscription = JSON.parse(raw);
      try {
        await sendPush(env, subscription, {
          title: "💊 İlaç Takibim",
          body: "Test bildirimi başarıyla ulaştı.",
          tag: "ilac-takibim-test"
        });
        return json({ ok: true });
      } catch (error) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await env.PUSH_KV.delete("subscription");
        }
        return json({ ok: false, error: String(error?.message || error) }, 500);
      }
    }

    return new Response("İlaç Takibim bildirim sunucusu aktif.", {
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=UTF-8" }
    });
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      const [subscriptionRaw, scheduleRaw] = await Promise.all([
        env.PUSH_KV.get("subscription"),
        env.PUSH_KV.get("schedule")
      ]);
      if (!subscriptionRaw || !scheduleRaw) return;

      const subscription = JSON.parse(subscriptionRaw);
      const schedule = JSON.parse(scheduleRaw);
      const timeZone = schedule.timeZone || "Europe/Istanbul";
      const meds = Array.isArray(schedule.meds) ? schedule.meds : [];
      if (!meds.length) return;

      const now = new Date(controller.scheduledTime);
      const local = getLocalParts(now, timeZone);
      const due = meds.filter(m => m.time === local.time);
      if (!due.length) return;

      const sentKey = `sent:${local.date}:${local.time}`;
      if (await env.PUSH_KV.get(sentKey)) return;

      const names = due.map(m => m.name);
      const body = names.length === 1
        ? `${names[0]} alma saatin geldi.`
        : `${names.join(", ")} alma saatin geldi.`;

      try {
        await sendPush(env, subscription, {
          title: "💊 İlaç Takibim",
          body,
          tag: `ilac-${local.date}-${local.time}`
        });
        await env.PUSH_KV.put(sentKey, "1", { expirationTtl: 172800 });
      } catch (error) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await env.PUSH_KV.delete("subscription");
        }
        throw error;
      }
    })());
  }
};
