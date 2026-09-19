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

    if (url.pathname === "/test" && request.method === "POST") {
      const raw = await env.PUSH_KV.get("subscription");
      if (!raw) return json({ ok: false, error: "Önce iPhone aboneliği gerekli" }, 404);

      webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
      const subscription = JSON.parse(raw);

      try {
        await webpush.sendNotification(subscription, JSON.stringify({
          title: "💊 İlaç Takibim",
          body: "Test bildirimi başarıyla ulaştı.",
          tag: "ilac-takibim-test"
        }));
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
  }
};
