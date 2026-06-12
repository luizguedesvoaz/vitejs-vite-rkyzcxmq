const SB_URL = "https://xhbalviwelidonrkoeim.supabase.co";
const SB_KEY = process.env.VITE_SB_KEY;
const EMAILJS_SERVICE  = "service_4k8k0hk";
const EMAILJS_TEMPLATE = "template_gk610v9";
const EMAILJS_PUBKEY   = "R7He8kE1mA8h4Mmgx";
const WA_PHONE  = "5511994009118";
const WA_APIKEY = process.env.VITE_WA_APIKEY;
const APP_URL   = "https://voaz-projetos.vercel.app";

export default async function handler(req, res) {
  // Aceita GET (do cron) ou POST (teste manual)
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  // Busca pendências com mais de 1 hora
  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const r = await fetch(`${SB_URL}/rest/v1/pendencias?criado_em=lte.${umaHoraAtras}&select=*`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
  });
  const pendencias = await r.json();

  if (!pendencias?.length) return res.status(200).json({ message: "Nenhuma pendência.", total: 0 });

  const resultados = [];

  for (const p of pendencias) {
    const emails = JSON.parse(p.emails || "[]");
    const discs  = JSON.parse(p.discs  || "[]");
    const now    = new Date().toLocaleString("pt-BR");
    const count  = discs.length;
    const discList = discs.map(d => `${d.icone} ${d.nome}`).join("\n");
    const obraUrl  = `${APP_URL}/?obra=${p.obra_id}`;

    // WhatsApp
    const waMsg = `📦 *VOAZ Obras — Pacote de Atualizações*\n\n🏢 Obra: ${p.obra_nome}\n🕐 ${now} — ${count} projeto${count!==1?"s":""} atualizado${count!==1?"s":""}:\n\n${discList}\n\n🔗 Acesse: ${obraUrl}`;
    try {
      await fetch(`https://api.callmebot.com/whatsapp.php?phone=${WA_PHONE}&text=${encodeURIComponent(waMsg)}&apikey=${WA_APIKEY}`);
    } catch(e) {}

    // Emails
    for (const email of emails) {
      try {
        await fetch("https://api.emailjs.com/api/v1.0/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service_id:  EMAILJS_SERVICE,
            template_id: EMAILJS_TEMPLATE,
            user_id:     EMAILJS_PUBKEY,
            template_params: {
              to_email:  email,
              obra_nome: p.obra_nome,
              data_hora: now,
              count:     String(count),
              disc_list: discs.map(d => `${d.icone} ${d.nome}`).join(" | "),
              obra_url:  obraUrl
            }
          })
        });
      } catch(e) {}
    }

    // Deleta a pendência processada
    await fetch(`${SB_URL}/rest/v1/pendencias?id=eq.${p.id}`, {
      method: "DELETE",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
    });

    resultados.push({ obra: p.obra_nome, emails: emails.length, discs: count });
  }

  return res.status(200).json({ message: "Notificações enviadas!", resultados });
}