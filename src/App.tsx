import { useState, useEffect, useRef } from "react";

// ── Config ───────────────────────────────────────────────────
const SB_URL = "https://xhbalviwelidonrkoeim.supabase.co";
const SB_KEY = import.meta.env.VITE_SB_KEY as string;
const ROW_ID = 1;
const BUCKET = "projetos";
const APP_URL = "https://voaz-projetos.vercel.app";
const WA_PHONE = "5511994009118";
const WA_APIKEY = import.meta.env.VITE_WA_APIKEY as string;
const EMAILJS_SERVICE  = "service_4k8k0hk";
const EMAILJS_TEMPLATE = "template_gk610v9";
const EMAILJS_PUBKEY   = "R7He8kE1mA8h4Mmgx";

// ── Supabase ─────────────────────────────────────────────────
async function sbGet() {
  const r = await fetch(`${SB_URL}/rest/v1/obras?id=eq.${ROW_ID}&select=dados`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
  });
  const data = await r.json();
  return data?.[0]?.dados ? JSON.parse(data[0].dados) : null;
}

async function sbSet(obras: any[]) {
  const exists = await fetch(`${SB_URL}/rest/v1/obras?id=eq.${ROW_ID}&select=id`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
  }).then(r => r.json());
  const body = JSON.stringify({ id: ROW_ID, dados: JSON.stringify(obras) });
  const method = exists?.length ? "PATCH" : "POST";
  const url = exists?.length ? `${SB_URL}/rest/v1/obras?id=eq.${ROW_ID}` : `${SB_URL}/rest/v1/obras`;
  await fetch(url, { method, headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body });
}

async function uploadPDF(file: File, obraId: string, discId: string): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `${obraId}/${discId}-${Date.now()}.${ext}`;
  const r = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": file.type, "x-upsert": "true" },
    body: file
  });
  if (!r.ok) throw new Error("Erro no upload");
  return `${SB_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

// ── Notificações ─────────────────────────────────────────────
// Fila de atualizações pendentes { obraId, obraNome, discs: [{icone, nome}], timer }
const pendingMap: Record<string, { obraNome: string; emails: string[]; discs: {icone:string;nome:string}[]; timer: any }> = {};

function scheduleNotification(obraId: string, obraNome: string, emails: string[], disc: {icone:string;nome:string}) {
  if (pendingMap[obraId]) {
    clearTimeout(pendingMap[obraId].timer);
    pendingMap[obraId].discs.push(disc);
  } else {
    pendingMap[obraId] = { obraNome, emails, discs: [disc], timer: null };
  }
  pendingMap[obraId].timer = setTimeout(() => {
    fireNotification(obraId);
  }, 3 * 60 * 60 * 1000); // 3 horas
}

async function fireNotification(obraId: string) {
  const p = pendingMap[obraId];
  if (!p) return;
  delete pendingMap[obraId];

  const discList = p.discs.map(d => `${d.icone} ${d.nome}`).join("\n");
  const discListHtml = p.discs.map(d => `<li style="margin:4px 0;">${d.icone} <strong>${d.nome}</strong></li>`).join("");
  const obraUrl = `${APP_URL}/?obra=${obraId}`;
  const count = p.discs.length;
  const now = new Date().toLocaleString("pt-BR");

  // WhatsApp
  const waMsg = encodeURIComponent(
    `📦 *VOAZ Obras — Pacote de Atualizações*\n\n` +
    `🏢 Obra: ${p.obraNome}\n` +
    `🕐 ${now} — ${count} projeto${count !== 1 ? "s" : ""} atualizado${count !== 1 ? "s" : ""}:\n\n` +
    `${discList}\n\n` +
    `🔗 Acesse: ${obraUrl}`
  );
  fetch(`https://api.callmebot.com/whatsapp.php?phone=${WA_PHONE}&text=${waMsg}&apikey=${WA_APIKEY}`).catch(() => {});

  // Email via EmailJS
  if (p.emails.length > 0) {
    for (const email of p.emails) {
      fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id:  EMAILJS_SERVICE,
          template_id: EMAILJS_TEMPLATE,
          user_id:     EMAILJS_PUBKEY,
          template_params: {
            to_email:  email,
            obra_nome: p.obraNome,
            data_hora: new Date().toLocaleString("pt-BR"),
            count:     String(p.discs.length),
            disc_list: p.discs.map(d => `${d.icone} ${d.nome}`).join(" | "),
            obra_url:  `${APP_URL}/?obra=${obraId}`,
          }
        })
      }).catch(() => {});
    }
  }
}

// ── QR Code ──────────────────────────────────────────────────
function QRCodeImg({ value, size = 140 }: { value: string; size?: number }) {
  return <img src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&margin=10`} width={size} height={size} style={{ display: "block", borderRadius: 6 }} alt="QR Code" />;
}

function printQRSheet(obra: any) {
  const size = 140;
  const makeQR = (val: string) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(val)}&margin=10`;
  const geralCard = `
    <div style="display:inline-flex;flex-direction:column;align-items:center;gap:8px;padding:16px;border:2px solid #111;border-radius:8px;background:#fff;width:190px;box-sizing:border-box;">
      <div style="font-size:28px;">🏢</div>
      <img src="${makeQR(`${APP_URL}/?obra=${obra.id}`)}" width="${size}" height="${size}" style="border-radius:4px;"/>
      <div style="text-align:center;"><div style="font-weight:700;font-size:13px;color:#111;">TODAS AS DISCIPLINAS</div><div style="font-size:11px;color:#444;margin-top:2px;">${obra.nome}</div></div>
    </div>`;
  const cards = obra.disciplinas.map((d: any) => `
    <div style="display:inline-flex;flex-direction:column;align-items:center;gap:8px;padding:16px;border:1px solid #ddd;border-radius:8px;background:#fff;width:190px;box-sizing:border-box;">
      <div style="font-size:28px;">${d.icone}</div>
      <img src="${makeQR(`${APP_URL}/?obra=${obra.id}&disc=${d.id}`)}" width="${size}" height="${size}" style="border-radius:4px;"/>
      <div style="text-align:center;"><div style="font-weight:600;font-size:13px;color:#111;">${d.nome}</div><div style="font-size:10px;color:#666;margin-top:2px;">${obra.nome}</div></div>
    </div>`).join("");
  const html = `<!DOCTYPE html><html><head><title>QR Codes — ${obra.nome}</title>
    <style>body{font-family:sans-serif;padding:24px;background:#f5f5f5;}h2{font-size:16px;color:#333;margin-bottom:16px;}.grid{display:flex;flex-wrap:wrap;gap:16px;}@media print{body{background:white;padding:12px;}@page{size:A4;margin:12mm;}}</style>
    </head><body><h2>QR Codes — ${obra.nome}</h2><div class="grid">${geralCard}${cards}</div>
    <script>window.onload=()=>{const imgs=document.querySelectorAll('img');let l=0;imgs.forEach(i=>{if(i.complete){l++;if(l===imgs.length)window.print();}else i.onload=()=>{l++;if(l===imgs.length)window.print();}});if(!imgs.length)window.print();};<\/script></body></html>`;
  const w = window.open("", "_blank")!; w.document.write(html); w.document.close();
}

function useDeepLink(obras: any[], setScreen: any, setObraId: any, setDiscId: any) {
  useEffect(() => {
    if (!obras.length) return;
    const p = new URLSearchParams(window.location.search);
    const oid = p.get("obra"), did = p.get("disc");
    if (oid) {
      const o = obras.find((x: any) => x.id === oid);
      if (o) { setObraId(oid); if (did && o.disciplinas.find((d: any) => d.id === did)) { setDiscId(did); setScreen("disciplina"); } else setScreen("obra"); }
    }
  }, [obras]);
}

const s = (e: any = {}) => ({ padding: "8px 16px", border: "0.5px solid #ccc", borderRadius: "8px", background: "transparent", cursor: "pointer", fontSize: 13, color: "#111", ...e });
const sp = (e: any = {}) => ({ ...s(), background: "#111", color: "#fff", fontWeight: 500, border: "none", ...e });

function Modal({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
      <div style={{ background: "#fff", borderRadius: "12px", padding: "1.5rem", width: 360, border: "0.5px solid #ddd", maxHeight: "85vh", overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 1rem", fontWeight: 500, fontSize: 16 }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function LoginModal({ title, onLogin, onClose }: any) {
  const [pw, setPw] = useState(""), [err, setErr] = useState("");
  const attempt = () => { if (!onLogin(pw)) setErr("Senha incorreta."); };
  return (
    <Modal title={title}>
      <input type="password" placeholder="Senha" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && attempt()}
        style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: "8px", border: "0.5px solid #ccc", fontSize: 14, marginBottom: 8 }} />
      {err && <p style={{ margin: "0 0 8px", fontSize: 12, color: "red" }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button style={s()} onClick={onClose}>Cancelar</button>
        <button style={sp()} onClick={attempt}>Entrar</button>
      </div>
    </Modal>
  );
}

function HistoricoModal({ disc, onClose }: any) {
  return (
    <Modal title={`Histórico — ${disc.nome}`}>
      {disc.pdfUrl && (
        <div style={{ marginBottom: 12, padding: "10px 12px", background: "#f5f5f5", borderRadius: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>Versão atual</p><p style={{ margin: 0, fontSize: 11, color: "#666" }}>{disc.pdfName} · {disc.updatedAt}</p></div>
            <a href={disc.pdfUrl} target="_blank" rel="noreferrer" style={{ ...sp({ fontSize: 11, padding: "4px 10px", textDecoration: "none" }) }}>Ver</a>
          </div>
        </div>
      )}
      {(!disc.historico || !disc.historico.length) ? <p style={{ fontSize: 13, color: "#666" }}>Nenhuma versão anterior.</p>
        : [...disc.historico].reverse().map((v: any, i: number) => (
          <div key={i} style={{ marginBottom: 8, padding: "8px 12px", border: "0.5px solid #ddd", borderRadius: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "#666" }}>Versão {disc.historico.length - i}</p><p style={{ margin: 0, fontSize: 11, color: "#999" }}>{v.pdfName} · {v.updatedAt}</p></div>
              <a href={v.pdfUrl} target="_blank" rel="noreferrer" style={{ ...s({ fontSize: 11, padding: "4px 10px", textDecoration: "none" }) }}>Ver</a>
            </div>
          </div>
        ))}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}><button style={s()} onClick={onClose}>Fechar</button></div>
    </Modal>
  );
}

// Modal de configuração de notificações da obra
function NotifModal({ obra, onSave, onClose }: { obra: any; onSave: (emails: string[]) => void; onClose: () => void }) {
  const [emailInput, setEmailInput] = useState("");
  const [emails, setEmails] = useState<string[]>(obra.notifEmails || []);
  const add = () => {
    const e = emailInput.trim().toLowerCase();
    if (!e || !e.includes("@") || emails.includes(e)) return;
    setEmails(prev => [...prev, e]);
    setEmailInput("");
  };
  return (
    <Modal title={`🔔 Notificações — ${obra.nome}`}>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#666" }}>
        Quando um PDF for atualizado, um resumo será enviado por WhatsApp e e-mail após 3 horas — agrupando todas as atualizações do período.
      </p>
      <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 500 }}>E-mails cadastrados:</p>
      {emails.length === 0 && <p style={{ fontSize: 12, color: "#aaa", margin: "0 0 8px" }}>Nenhum e-mail cadastrado.</p>}
      {emails.map((e, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "#f5f5f5", borderRadius: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 13 }}>{e}</span>
          <button style={{ ...s({ fontSize: 11, padding: "2px 8px", color: "red" }) }} onClick={() => setEmails(prev => prev.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 8, marginBottom: 16 }}>
        <input placeholder="email@empresa.com" value={emailInput} onChange={e => setEmailInput(e.target.value)} onKeyDown={e => e.key === "Enter" && add()}
          style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "0.5px solid #ccc", fontSize: 13 }} />
        <button style={sp({ padding: "8px 14px" })} onClick={add}>+ Add</button>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button style={s()} onClick={onClose}>Cancelar</button>
        <button style={sp()} onClick={() => onSave(emails)}>Salvar</button>
      </div>
    </Modal>
  );
}

const defaultObras = [{
  id: "demo-obra", nome: "Obra Demo — Torre Jardins", notifEmails: [],
  disciplinas: [
    { id: "estrutura", nome: "Estrutura", icone: "🏗️", pdfUrl: "", pdfName: "", updatedAt: null, historico: [] },
    { id: "eletrica", nome: "Elétrica", icone: "⚡", pdfUrl: "", pdfName: "", updatedAt: null, historico: [] },
    { id: "hidraulica", nome: "Hidráulica", icone: "💧", pdfUrl: "", pdfName: "", updatedAt: null, historico: [] },
    { id: "arq-proj", nome: "Arquitetura", icone: "📐", pdfUrl: "", pdfName: "", updatedAt: null, historico: [] },
  ]
}];

export default function App() {
  const [obras, setObras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("home");
  const [role, setRole] = useState<string | null>(null);
  const [obraId, setObraId] = useState<string | null>(null);
  const [discId, setDiscId] = useState<string | null>(null);
  const [loginFor, setLoginFor] = useState<string | null>(null);
  const [showQR, setShowQR] = useState<string | null>(null);
  const [showGeralQR, setShowGeralQR] = useState(false);
  const [historicoDisc, setHistoricoDisc] = useState<string | null>(null);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [addDiscModal, setAddDiscModal] = useState(false);
  const [addObraModal, setAddObraModal] = useState(false);
  const [newNome, setNewNome] = useState(""), [newIcone, setNewIcone] = useState("📋");
  const [newObraNome, setNewObraNome] = useState("");
  const [activeUpload, setActiveUpload] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const obra = obras.find(o => o.id === obraId);

  useEffect(() => {
    sbGet().then(data => { setObras(data || defaultObras); setLoading(false); })
      .catch(() => { setObras(defaultObras); setLoading(false); });
  }, []);

  useDeepLink(obras, setScreen, setObraId, setDiscId);

  const upd = (fn: (p: any[]) => any[]) => setObras(prev => { const next = fn(prev); sbSet(next).catch(console.error); return next; });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeUpload || !obraId) return;
    setUploading(true);
    try {
      const url = await uploadPDF(file, obraId, activeUpload);
      upd(prev => prev.map(o => {
        if (o.id !== obraId) return o;
        const disc = o.disciplinas.find((d: any) => d.id === activeUpload);
        if (disc) scheduleNotification(obraId, o.nome, o.notifEmails || [], { icone: disc.icone, nome: disc.nome });
        return {
          ...o, disciplinas: o.disciplinas.map((d: any) => {
            if (d.id !== activeUpload) return d;
            const hist = d.pdfUrl ? [...(d.historico || []), { pdfUrl: d.pdfUrl, pdfName: d.pdfName, updatedAt: d.updatedAt }] : (d.historico || []);
            return { ...d, pdfUrl: url, pdfName: file.name, updatedAt: new Date().toLocaleString("pt-BR"), historico: hist };
          })
        };
      }));
    } catch { alert("Erro ao fazer upload. Tente novamente."); }
    finally { setUploading(false); setActiveUpload(null); e.target.value = ""; }
  };

  const triggerUpload = (id: string) => { setActiveUpload(id); setTimeout(() => fileRef.current?.click(), 50); };
  const doLogin = (pw: string) => {
    if (loginFor === "pm" && pw === "PMVOAZ@2026") { setRole("pm"); setLoginFor(null); setScreen(obraId ? "pm" : "home"); return true; }
    if (loginFor === "compras" && pw === "COMPRASVOAZ@2026") { setRole("compras"); setLoginFor(null); setScreen("compras"); return true; }
    return false;
  };
  const goHome = () => { setScreen("home"); setObraId(null); setDiscId(null); setRole(null); setShowQR(null); setShowGeralQR(false); };
  const goObra = (id: string) => { setObraId(id); setScreen("obra"); setShowQR(null); setShowGeralQR(false); };
  const addDisc = () => {
    if (!newNome.trim()) return;
    const id = newNome.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now();
    upd(prev => prev.map(o => o.id !== obraId ? o : { ...o, disciplinas: [...o.disciplinas, { id, nome: newNome, icone: newIcone, pdfUrl: "", pdfName: "", updatedAt: null, historico: [] }] }));
    setNewNome(""); setNewIcone("📋"); setAddDiscModal(false);
  };
  const removeDisc = (id: string) => upd(prev => prev.map(o => o.id !== obraId ? o : { ...o, disciplinas: o.disciplinas.filter((d: any) => d.id !== id) }));
  const addObra = () => {
    if (!newObraNome.trim()) return;
    upd(prev => [...prev, { id: "obra-" + Date.now(), nome: newObraNome, notifEmails: [], disciplinas: [] }]);
    setNewObraNome(""); setAddObraModal(false);
  };
  const removeObra = (id: string) => upd(prev => prev.filter(o => o.id !== id));
  const saveNotifEmails = (emails: string[]) => {
    upd(prev => prev.map(o => o.id !== obraId ? o : { ...o, notifEmails: emails }));
    setShowNotifModal(false);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
      <p style={{ color: "#666", fontSize: 15 }}>Carregando obras... 🏗️</p>
    </div>
  );

  // DISCIPLINA
  if (screen === "disciplina" && obra) {
    const d = obra.disciplinas.find((x: any) => x.id === discId);
    if (!d) { setScreen("obra"); return null; }
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", gap: "1.2rem", textAlign: "center", fontFamily: "sans-serif" }}>
        <span style={{ fontSize: 56 }}>{d.icone}</span>
        <div><p style={{ margin: "0 0 2px", fontSize: 12, color: "#666" }}>{obra.nome}</p><h2 style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>{d.nome}</h2></div>
        {d.pdfUrl ? <>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>{d.pdfName} · {d.updatedAt}</p>
          <a href={d.pdfUrl} target="_blank" rel="noreferrer" style={{ padding: "12px 32px", background: "#111", color: "#fff", borderRadius: "12px", textDecoration: "none", fontWeight: 500, fontSize: 15 }}>Abrir Projeto PDF</a>
        </> : <p style={{ color: "#666", fontSize: 14 }}>Nenhum projeto cadastrado.</p>}
        <button style={s({ marginTop: 4 })} onClick={() => setScreen("obra")}>← Voltar</button>
      </div>
    );
  }

  // OBRA
  if (screen === "obra" && obra) {
    return (
      <div style={{ padding: "1.5rem", fontFamily: "sans-serif", maxWidth: 700, margin: "0 auto" }}>
        <input type="file" accept=".pdf" ref={fileRef} onChange={handleFile} style={{ display: "none" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: 8 }}>
          <div>
            <button style={{ ...s({ padding: "4px 0", border: "none", fontSize: 12, color: "#666" }), marginBottom: 4 }} onClick={goHome}>← Obras</button>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>{obra.nome}</h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {role === "pm" && <button style={s()} onClick={() => setScreen("pm")}>⚙️ Gerenciar</button>}
            {!role && <button style={{ ...s({ fontSize: 11, color: "#999", padding: "4px 8px" }) }} onClick={() => setLoginFor("pm")}>PM/Arq</button>}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
          {obra.disciplinas.map((d: any) => (
            <button key={d.id} onClick={() => { setDiscId(d.id); setScreen("disciplina"); }}
              style={{ background: "#fff", border: "0.5px solid #ddd", borderRadius: "12px", padding: "1.25rem 1rem", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 32 }}>{d.icone}</span>
              <span style={{ fontWeight: 500, fontSize: 13, color: "#111" }}>{d.nome}</span>
              <span style={{ fontSize: 11, color: d.pdfUrl ? "#16a34a" : "#aaa" }}>{d.pdfUrl ? "✓ Disponível" : "Sem projeto"}</span>
            </button>
          ))}
          {obra.disciplinas.length === 0 && <p style={{ color: "#666", fontSize: 13, gridColumn: "1/-1" }}>Nenhuma disciplina cadastrada.</p>}
        </div>
        {loginFor && <LoginModal title="PM / Arquiteto" onLogin={doLogin} onClose={() => setLoginFor(null)} />}
      </div>
    );
  }

  // PM
  if (screen === "pm" && obra) {
    const disc = historicoDisc ? obra.disciplinas.find((d: any) => d.id === historicoDisc) : null;
    return (
      <div style={{ padding: "1.5rem", fontFamily: "sans-serif", maxWidth: 700, margin: "0 auto" }}>
        <input type="file" accept=".pdf" ref={fileRef} onChange={handleFile} style={{ display: "none" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: 8 }}>
          <div>
            <button style={{ ...s({ padding: "4px 0", border: "none", fontSize: 12, color: "#666" }), marginBottom: 4 }} onClick={() => setScreen("obra")}>← {obra.nome}</button>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>PM / Arquiteto</h1>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={s()} onClick={() => setShowNotifModal(true)}>🔔 Notificações {obra.notifEmails?.length > 0 ? `(${obra.notifEmails.length})` : ""}</button>
            <button style={s({background:"#fef9c3"})} onClick={async () => {
              const dados = await sbGet();
              const o = dados?.find((x: any) => x.id === obraId);
              const emails = o?.notifEmails || [];
              alert(`E-mails encontrados: ${emails.length}\n${emails.join(", ")}`);
              const waMsg = encodeURIComponent(`📦 *VOAZ Obras — TESTE*\n\n🏢 Obra: ${o?.nome}\n🕐 ${new Date().toLocaleString("pt-BR")}\n\n🔗 ${APP_URL}/?obra=${obraId}`);
              await fetch(`https://api.callmebot.com/whatsapp.php?phone=${WA_PHONE}&text=${waMsg}&apikey=${WA_APIKEY}`);
              for (const email of emails) {
                const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    service_id: EMAILJS_SERVICE, template_id: EMAILJS_TEMPLATE, user_id: EMAILJS_PUBKEY,
                    template_params: { to_email: email, obra_nome: o?.nome, data_hora: new Date().toLocaleString("pt-BR"), count: "1", disc_list: "🧪 Teste de notificação", obra_url: `${APP_URL}/?obra=${obraId}` }
                  })
                });
                const txt = await res.text();
                alert(`Email: ${email}\nStatus: ${res.status}\nResposta: ${txt}`);
              }
            }}>🧪 Testar Notif</button>
            <button style={s()} onClick={() => printQRSheet(obra)}>🖨️ Imprimir QR</button>
            <button style={s()} onClick={() => setAddDiscModal(true)}>+ Disciplina</button>
            <button style={s({ color: "#666" })} onClick={goHome}>Sair</button>
          </div>
        </div>

        {/* QR Geral */}
        <div style={{ background: "#fff", border: "2px solid #111", borderRadius: "12px", padding: "1rem 1.25rem", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 26 }}>🏢</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>QR Geral — {obra.nome}</p>
              <p style={{ margin: 0, fontSize: 11, color: "#666" }}>Mostra todas as disciplinas da obra</p>
            </div>
            <button style={s({ fontSize: 12, padding: "5px 12px" })} onClick={() => setShowGeralQR(!showGeralQR)}>{showGeralQR ? "Fechar" : "Ver QR Geral"}</button>
          </div>
          {showGeralQR && (
            <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "0.5px solid #eee", display: "flex", gap: "1.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
              <QRCodeImg value={`${APP_URL}/?obra=${obraId}`} size={140} />
              <div>
                <p style={{ margin: "0 0 4px", fontWeight: 500, fontSize: 13 }}>Aponte a câmera para escanear</p>
                <p style={{ margin: "0 0 8px", fontSize: 12, color: "#666" }}>Abre a lista completa de disciplinas.</p>
                <p style={{ margin: 0, fontSize: 10, fontFamily: "monospace", color: "#aaa", background: "#f5f5f5", padding: "4px 8px", borderRadius: 4 }}>{APP_URL}/?obra={obraId}</p>
              </div>
            </div>
          )}
        </div>

        {/* Notif info */}
        {obra.notifEmails?.length > 0 && (
          <div style={{ background: "#f0fdf4", border: "0.5px solid #16a34a", borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 12, color: "#166534" }}>
            🔔 Notificações ativas para {obra.notifEmails.length} e-mail{obra.notifEmails.length !== 1 ? "s" : ""} + WhatsApp. Agrupadas a cada 3 horas.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {obra.disciplinas.map((d: any) => (
            <div key={d.id} style={{ background: "#fff", border: "0.5px solid #ddd", borderRadius: "12px", padding: "1rem 1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 26 }}>{d.icone}</span>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <p style={{ margin: 0, fontWeight: 500, fontSize: 14 }}>{d.nome}</p>
                  <p style={{ margin: 0, fontSize: 11, color: "#666" }}>
                    {d.pdfName ? `${d.pdfName} · ${d.updatedAt}` : "Sem PDF"}
                    {d.historico?.length > 0 && <span style={{ color: "#aaa" }}> · {d.historico.length} versão(ões) anterior(es)</span>}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button style={s({ fontSize: 12, padding: "5px 12px" })} onClick={() => triggerUpload(d.id)} disabled={uploading}>
                    {uploading && activeUpload === d.id ? "⏳ Enviando..." : d.pdfUrl ? "Atualizar PDF" : "Upload PDF"}
                  </button>
                  <button style={s({ fontSize: 12, padding: "5px 12px" })} onClick={() => setHistoricoDisc(d.id)}>Histórico</button>
                  <button style={s({ fontSize: 12, padding: "5px 12px" })} onClick={() => setShowQR(showQR === d.id ? null : d.id)}>QR Code</button>
                  <button style={s({ fontSize: 12, padding: "5px 10px", color: "red" })} onClick={() => removeDisc(d.id)}>✕</button>
                </div>
              </div>
              {showQR === d.id && (
                <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "0.5px solid #eee", display: "flex", gap: "1.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
                  <QRCodeImg value={`${APP_URL}/?obra=${obraId}&disc=${d.id}`} size={140} />
                  <div>
                    <p style={{ margin: "0 0 4px", fontWeight: 500, fontSize: 13 }}>{obra.nome} — {d.nome}</p>
                    <p style={{ margin: "0 0 8px", fontSize: 12, color: "#666" }}>QR code permanente. Nunca muda.</p>
                    <p style={{ margin: 0, fontSize: 10, fontFamily: "monospace", color: "#aaa", background: "#f5f5f5", padding: "4px 8px", borderRadius: 4 }}>{APP_URL}/?obra={obraId}&disc={d.id}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
          {obra.disciplinas.length === 0 && <p style={{ color: "#666", fontSize: 13 }}>Nenhuma disciplina. Adicione a primeira!</p>}
        </div>

        {disc && <HistoricoModal disc={disc} onClose={() => setHistoricoDisc(null)} />}
        {showNotifModal && <NotifModal obra={obra} onSave={saveNotifEmails} onClose={() => setShowNotifModal(false)} />}
        {addDiscModal && (
          <Modal title="Nova Disciplina">
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input value={newIcone} onChange={e => setNewIcone(e.target.value)} style={{ width: 46, textAlign: "center", fontSize: 20, borderRadius: "8px", border: "0.5px solid #ccc", padding: "6px" }} />
              <input placeholder="Nome" value={newNome} onChange={e => setNewNome(e.target.value)} onKeyDown={e => e.key === "Enter" && addDisc()} style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "0.5px solid #ccc", fontSize: 14 }} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={s()} onClick={() => setAddDiscModal(false)}>Cancelar</button>
              <button style={sp()} onClick={addDisc}>Criar</button>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // COMPRAS
  if (screen === "compras") {
    return (
      <div style={{ padding: "1.5rem", fontFamily: "sans-serif", maxWidth: 700, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div><h1 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>Compras & Orçamentos</h1><p style={{ margin: 0, fontSize: 12, color: "#666" }}>Todos os projetos — versões atuais</p></div>
          <button style={s({ color: "#666" })} onClick={goHome}>Sair</button>
        </div>
        {obras.map(o => (
          <div key={o.id} style={{ marginBottom: "1.5rem" }}>
            <p style={{ margin: "0 0 8px", fontWeight: 500, fontSize: 14 }}>🏢 {o.nome}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {!o.disciplinas.length && <p style={{ fontSize: 12, color: "#aaa", margin: 0 }}>Sem disciplinas.</p>}
              {o.disciplinas.map((d: any) => (
                <div key={d.id} style={{ background: "#fff", border: "0.5px solid #ddd", borderRadius: "8px", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 20 }}>{d.icone}</span>
                  <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{d.nome}</p><p style={{ margin: 0, fontSize: 11, color: "#666" }}>{d.pdfName ? `${d.pdfName} · ${d.updatedAt}` : "Sem projeto"}</p></div>
                  {d.pdfUrl ? <a href={d.pdfUrl} target="_blank" rel="noreferrer" style={{ ...sp({ fontSize: 12, padding: "5px 12px", textDecoration: "none" }) }}>Baixar PDF</a> : <span style={{ fontSize: 11, color: "#aaa" }}>—</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // HOME
  return (
    <div style={{ padding: "1.5rem", fontFamily: "sans-serif", maxWidth: 700, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: 8 }}>
        <div><h1 style={{ margin: 0, fontSize: 20, fontWeight: 500 }}>VOAZ Obras</h1><p style={{ margin: 0, fontSize: 13, color: "#666" }}>Selecione a obra</p></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {role === "pm" && <button style={s()} onClick={() => setAddObraModal(true)}>+ Nova obra</button>}
          <button style={s({ fontSize: 12, padding: "6px 12px" })} onClick={() => setLoginFor("pm")}>PM / Arq</button>
          <button style={s({ fontSize: 12, padding: "6px 12px" })} onClick={() => setLoginFor("compras")}>Compras</button>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {obras.map(o => (
          <div key={o.id} style={{ background: "#fff", border: "0.5px solid #ddd", borderRadius: "12px", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 28 }}>🏢</span>
            <div style={{ flex: 1 }}><p style={{ margin: 0, fontWeight: 500, fontSize: 15 }}>{o.nome}</p><p style={{ margin: 0, fontSize: 12, color: "#666" }}>{o.disciplinas.length} disciplina{o.disciplinas.length !== 1 ? "s" : ""}</p></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={sp({ fontSize: 13 })} onClick={() => goObra(o.id)}>Abrir</button>
              {role === "pm" && <button style={s({ fontSize: 12, color: "red", padding: "6px 10px" })} onClick={() => removeObra(o.id)}>✕</button>}
            </div>
          </div>
        ))}
        {!obras.length && <p style={{ color: "#666", fontSize: 13 }}>Nenhuma obra cadastrada.</p>}
      </div>
      {loginFor && <LoginModal title={loginFor === "pm" ? "PM / Arquiteto" : "Compras & Orçamentos"} onLogin={doLogin} onClose={() => setLoginFor(null)} />}
      {addObraModal && (
        <Modal title="Nova Obra">
          <input placeholder="Nome da obra" value={newObraNome} onChange={e => setNewObraNome(e.target.value)} onKeyDown={e => e.key === "Enter" && addObra()}
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: "8px", border: "0.5px solid #ccc", fontSize: 14, marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button style={s()} onClick={() => setAddObraModal(false)}>Cancelar</button>
            <button style={sp()} onClick={addObra}>Criar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}