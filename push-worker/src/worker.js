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

function validClientId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{20,100}$/.test(value);
}

function getLocalParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const weekdayMap = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`,
    weekday: weekdayMap[map.weekday],
  };
}

async function sendPush(env, subscription, payload) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  return webpush.sendNotification(subscription, JSON.stringify(payload));
}

async function removeClient(env, clientId) {
  await Promise.all([
    env.PUSH_KV.delete(`subscription:${clientId}`),
    env.PUSH_KV.delete(`schedule:${clientId}`)
  ]);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true, service: "İlaç Takibim Push", mode: "multi-user" });
    }

    if (url.pathname === "/vapid-public-key") {
      return json({ publicKey: env.VAPID_PUBLIC_KEY });
    }

    if (url.pathname === "/subscribe" && request.method === "POST") {
      const body = await request.json();
      const clientId = body?.clientId;
      const subscription = body?.subscription;
      if (!validClientId(clientId) || !subscription?.endpoint) {
        return json({ ok: false, error: "Geçersiz istemci veya abonelik" }, 400);
      }
      await env.PUSH_KV.put(`subscription:${clientId}`, JSON.stringify(subscription));
      return json({ ok: true });
    }

    if (url.pathname === "/schedule" && request.method === "POST") {
      const body = await request.json();
      const clientId = body?.clientId;
      if (!validClientId(clientId)) return json({ ok: false, error: "Geçersiz istemci" }, 400);

      const timeZone = String(body?.timeZone || "Europe/Istanbul").slice(0, 80);
      const meds = Array.isArray(body?.meds) ? body.meds
        .filter(m => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(m?.time || "")) && String(m?.name || "").trim())
        .slice(0, 100)
        .map(m => ({
          time: String(m.time),
          name: String(m.name).trim().slice(0, 120),
          days: Array.isArray(m.days)
            ? [...new Set(m.days.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))]
            : [0,1,2,3,4,5,6],
          startDate: /^\d{4}-\d{2}-\d{2}$/.test(String(m.startDate || "")) ? String(m.startDate) : "",
          endDate: /^\d{4}-\d{2}-\d{2}$/.test(String(m.endDate || "")) ? String(m.endDate) : ""
        }))
        .map(m => ({ ...m, days: m.days.length ? m.days : [0,1,2,3,4,5,6] })) : [];

      await env.PUSH_KV.put(
        `schedule:${clientId}`,
        JSON.stringify({ timeZone, meds, updatedAt: Date.now() })
      );
      return json({ ok: true, count: meds.length });
    }

    if (url.pathname === "/test" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const clientId = body?.clientId;
      if (!validClientId(clientId)) return json({ ok: false, error: "Geçersiz istemci" }, 400);

      const raw = await env.PUSH_KV.get(`subscription:${clientId}`);
      if (!raw) return json({ ok: false, error: "Önce bildirimleri etkinleştirin" }, 404);

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
          await removeClient(env, clientId);
        }
        return json({ ok: false, error: String(error?.message || error) }, 500);
      }
    }

    if (url.pathname === "/scheduled-test" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const clientId = body?.clientId;
      if (!validClientId(clientId)) return json({ ok: false, error: "Geçersiz istemci" }, 400);

      const raw = await env.PUSH_KV.get(`subscription:${clientId}`);
      if (!raw) return json({ ok: false, error: "Önce bildirimleri etkinleştirin" }, 404);

      const dueAt = Date.now() + 120000;
      await env.PUSH_KV.put(
        `scheduled-test:${clientId}`,
        JSON.stringify({ dueAt }),
        { expirationTtl: 600 }
      );
      return json({ ok: true, dueAt });
    }

    if (url.pathname === "/delete" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const clientId = body?.clientId;
      if (!validClientId(clientId)) return json({ ok: false, error: "Geçersiz istemci" }, 400);
      await removeClient(env, clientId);
      return json({ ok: true });
    }

    return new Response("İlaç Takibim bildirim sunucusu aktif.", {
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=UTF-8" }
    });
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      const nowMs = controller.scheduledTime;
      let testCursor;
      do {
        const testPage = await env.PUSH_KV.list({ prefix: "scheduled-test:", cursor: testCursor, limit: 250 });
        testCursor = testPage.list_complete ? undefined : testPage.cursor;

        for (const item of testPage.keys) {
          const clientId = item.name.slice("scheduled-test:".length);
          if (!validClientId(clientId)) continue;

          const testRaw = await env.PUSH_KV.get(item.name);
          if (!testRaw) continue;
          const test = JSON.parse(testRaw);
          if (!test?.dueAt || test.dueAt > nowMs) continue;

          const subscriptionRaw = await env.PUSH_KV.get(`subscription:${clientId}`);
          if (!subscriptionRaw) {
            await env.PUSH_KV.delete(item.name);
            continue;
          }

          try {
            await sendPush(env, JSON.parse(subscriptionRaw), {
              title: "⏰ İlaç Takibim",
              body: "Zamanlı bildirim testi başarılı.",
              tag: `scheduled-test-${clientId}`
            });
            await env.PUSH_KV.delete(item.name);
          } catch (error) {
            if (error?.statusCode === 404 || error?.statusCode === 410) {
              await removeClient(env, clientId);
              await env.PUSH_KV.delete(item.name);
            }
          }
        }
      } while (testCursor);

      let cursor;
      do {
        const page = await env.PUSH_KV.list({ prefix: "schedule:", cursor, limit: 250 });
        cursor = page.list_complete ? undefined : page.cursor;

        for (const item of page.keys) {
          const clientId = item.name.slice("schedule:".length);
          if (!validClientId(clientId)) continue;

          const [subscriptionRaw, scheduleRaw] = await Promise.all([
            env.PUSH_KV.get(`subscription:${clientId}`),
            env.PUSH_KV.get(item.name)
          ]);
          if (!subscriptionRaw || !scheduleRaw) continue;

          const subscription = JSON.parse(subscriptionRaw);
          const schedule = JSON.parse(scheduleRaw);
          const timeZone = schedule.timeZone || "Europe/Istanbul";
          const meds = Array.isArray(schedule.meds) ? schedule.meds : [];
          if (!meds.length) continue;

          let local;
          try {
            local = getLocalParts(new Date(controller.scheduledTime), timeZone);
          } catch {
            local = getLocalParts(new Date(controller.scheduledTime), "Europe/Istanbul");
          }

          const due = meds.filter(m => {
            const days = Array.isArray(m.days) && m.days.length ? m.days : [0,1,2,3,4,5,6];
            if (m.time !== local.time || !days.includes(local.weekday)) return false;
            if (m.startDate && local.date < m.startDate) return false;
            if (m.endDate && local.date > m.endDate) return false;
            return true;
          });
          if (!due.length) continue;

          const sentKey = `sent:${clientId}:${local.date}:${local.time}`;
          if (await env.PUSH_KV.get(sentKey)) continue;

          const names = due.map(m => m.name);
          const body = names.length === 1
            ? `${names[0]} alma saatin geldi.`
            : `${names.join(", ")} alma saatin geldi.`;

          try {
            await sendPush(env, subscription, {
              title: "💊 İlaç Takibim",
              body,
              tag: `ilac-${clientId}-${local.date}-${local.time}`
            });
            await env.PUSH_KV.put(sentKey, "1", { expirationTtl: 172800 });
          } catch (error) {
            if (error?.statusCode === 404 || error?.statusCode === 410) {
              await removeClient(env, clientId);
            }
          }
        }
      } while (cursor);
    })());
  }
};
