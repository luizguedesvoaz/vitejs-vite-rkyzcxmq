export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).end();
  
    const { waPhone, waApikey, waMsg, emails, emailService, emailTemplate, emailPubkey, templateParams } = req.body;
  
    const results = { whatsapp: null, emails: [] };
  
    // WhatsApp
    try {
      const waUrl = `https://api.callmebot.com/whatsapp.php?phone=${waPhone}&text=${encodeURIComponent(waMsg)}&apikey=${waApikey}`;
      const waRes = await fetch(waUrl);
      results.whatsapp = waRes.status;
    } catch(e) {
      results.whatsapp = "erro: " + e.message;
    }
  
    // Emails via EmailJS
    for (const email of (emails || [])) {
      try {
        const ejRes = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service_id: emailService,
            template_id: emailTemplate,
            user_id: emailPubkey,
            template_params: { ...templateParams, to_email: email }
          })
        });
        const txt = await ejRes.text();
        results.emails.push({ email, status: ejRes.status, text: txt });
      } catch(e) {
        results.emails.push({ email, status: "erro", text: e.message });
      }
    }
  
    return res.status(200).json(results);
  }