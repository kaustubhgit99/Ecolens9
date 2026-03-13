"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Profile = { id: string; full_name: string; role: string; coins_total: number; coins_month: number; ward: string | null };
type Complaint = { id: string; title: string | null; description: string | null; status: string; ai_priority: string | null; ai_category: string | null; address: string | null; created_at: string; image_url: string | null };

const S: Record<string, { label: string; c: string; bg: string }> = {
  pending:       { label: "Pending",     c: "#94A3B8", bg: "rgba(148,163,184,.1)" },
  ai_processing: { label: "Processing",  c: "#A78BFA", bg: "rgba(139,92,246,.1)" },
  rejected_spam: { label: "Rejected",    c: "#FCA5A5", bg: "rgba(239,68,68,.1)" },
  merged:        { label: "Merged",      c: "#FCD34D", bg: "rgba(245,158,11,.1)" },
  routed:        { label: "Routed",      c: "#86EFAC", bg: "rgba(46,204,113,.1)" },
  in_progress:   { label: "In Progress", c: "#FCD34D", bg: "rgba(245,158,11,.12)" },
  resolved:      { label: "Resolved",    c: "#6EE7B7", bg: "rgba(16,185,129,.12)" },
};
const P: Record<string, { c: string; dot: string }> = {
  High:   { c: "#FCA5A5", dot: "#EF4444" },
  Medium: { c: "#FCD34D", dot: "#F59E0B" },
  Low:    { c: "#93C5FD", dot: "#3B82F6" },
};

function timeAgo(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return `${Math.floor((Date.now() - new Date(iso).getTime()) / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function CitizenDashboardClient({ profile, complaints, unreadCount }: { profile: Profile; complaints: Complaint[]; unreadCount: number }) {
  const router = useRouter();
  const supabase = createClient();
  const [loggingOut, setLoggingOut] = useState(false);
  const [tab, setTab] = useState("all");

  const filtered = tab === "all" ? complaints : complaints.filter(c =>
    tab === "active" ? ["in_progress","routed","ai_processing"].includes(c.status) : c.status === tab
  );

  const logout = async () => { setLoggingOut(true); await supabase.auth.signOut(); router.push("/login"); router.refresh(); };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=IBM+Plex+Mono:wght@500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#0F172A;color:#F8FAFC;font-family:'DM Sans',sans-serif}
        .pg{min-height:100vh;display:flex;flex-direction:column;background:#0F172A}
        .bar{background:rgba(15,23,42,.97);border-bottom:1px solid rgba(255,255,255,.06);padding:.85rem 1.25rem;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10}
        .brand{display:flex;align-items:center;gap:.5rem;font-size:1rem;font-weight:700}
        .dot{width:8px;height:8px;background:#2ECC71;border-radius:50%}
        .bar-r{display:flex;align-items:center;gap:.75rem}
        .logout{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:#FCA5A5;border-radius:8px;padding:.4rem .75rem;font-size:.78rem;font-weight:600;cursor:pointer;font-family:inherit}
        .main{flex:1;padding:1.25rem;max-width:720px;margin:0 auto;width:100%}
        .greet{margin-bottom:1.5rem}
        .greet h1{font-size:1.35rem;font-weight:700;letter-spacing:-.02em}
        .greet p{font-size:.8rem;color:#64748B;margin-top:.2rem}
        .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:1.25rem}
        .sc{background:rgba(30,41,59,.7);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:.85rem}
        .sc-lbl{font-size:.65rem;color:#475569;text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem}
        .sc-val{font-size:1.4rem;font-weight:700;font-family:'IBM Plex Mono',monospace}
        .coin{background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.2);border-radius:12px;padding:1rem;margin-bottom:1.25rem;display:flex;align-items:center;justify-content:space-between}
        .coin-l{display:flex;align-items:center;gap:.65rem}
        .coin-em{font-size:1.8rem}
        .coin-t{font-size:.72rem;color:#94A3B8;text-transform:uppercase;letter-spacing:.06em}
        .coin-v{font-size:1.35rem;font-weight:700;color:#FCD34D;font-family:'IBM Plex Mono',monospace}
        .coin-m{font-size:.7rem;color:#F59E0B;margin-top:2px}
        .rpbtn{background:#2ECC71;color:#0F172A;font-weight:700;font-size:.88rem;border:none;border-radius:10px;padding:.62rem 1.2rem;cursor:pointer;transition:all .2s;font-family:inherit}
        .rpbtn:hover{background:#27ae60;transform:translateY(-1px);box-shadow:0 4px 18px rgba(46,204,113,.35)}
        .sh{display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem}
        .sh-t{font-size:.95rem;font-weight:700}
        .tabs{display:flex;gap:.3rem;flex-wrap:wrap}
        .tab{padding:.3rem .7rem;border-radius:20px;border:1px solid rgba(255,255,255,.07);background:none;color:#64748B;font-size:.74rem;cursor:pointer;font-family:inherit;transition:all .2s}
        .tab.on{background:rgba(46,204,113,.12);border-color:rgba(46,204,113,.3);color:#2ECC71}
        .list{display:flex;flex-direction:column;gap:.6rem}
        .cc{background:rgba(30,41,59,.7);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:1rem;cursor:pointer;transition:all .2s}
        .cc:hover{border-color:rgba(255,255,255,.1);background:rgba(30,41,59,.9)}
        .cc-top{display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem}
        .cc-title{font-size:.88rem;font-weight:600;line-height:1.3}
        .cc-meta{font-size:.7rem;color:#475569;margin-top:.2rem}
        .cc-desc{font-size:.78rem;color:#64748B;margin-top:.35rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.5}
        .pill{display:inline-flex;align-items:center;gap:.3rem;border-radius:20px;padding:.18rem .55rem;font-size:.7rem;font-weight:700}
        .pdot{width:5px;height:5px;border-radius:50%;flex-shrink:0}
        .empty{text-align:center;padding:3rem 1rem;color:#475569}
        .fab{position:fixed;bottom:1.5rem;right:1.5rem;width:54px;height:54px;border-radius:50%;background:#2ECC71;color:#0F172A;border:none;cursor:pointer;font-size:1.5rem;box-shadow:0 4px 24px rgba(46,204,113,.4);display:flex;align-items:center;justify-content:center;transition:all .2s;z-index:20;font-family:inherit}
        .fab:hover{transform:scale(1.08)}
        @media(max-width:480px){.stats{grid-template-columns:repeat(2,1fr)}.coin{flex-direction:column;align-items:flex-start;gap:.75rem}}
      `}</style>
      <div className="pg">
        <header className="bar">
          <div className="brand"><div className="dot" />EcoLens</div>
          <div className="bar-r">
            {unreadCount > 0 && <span style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.25)", color: "#FCA5A5", borderRadius: "20px", padding: ".25rem .65rem", fontSize: ".75rem", fontWeight: 700 }}>🔔 {unreadCount}</span>}
            <button className="logout" onClick={logout} disabled={loggingOut}>{loggingOut ? "…" : "Sign out"}</button>
          </div>
        </header>
        <main className="main">
          <div className="greet">
            <h1>Hello, {profile.full_name.split(" ")[0]} 👋</h1>
            <p>Amravati Civic Platform · {profile.ward ?? "Amravati"}</p>
          </div>
          <div className="stats">
            {[{ l: "Total", v: complaints.length, c: "#94A3B8" }, { l: "Active", v: complaints.filter(c => ["in_progress","routed"].includes(c.status)).length, c: "#FCD34D" }, { l: "Resolved", v: complaints.filter(c => c.status === "resolved").length, c: "#2ECC71" }].map(s => (
              <div className="sc" key={s.l}><div className="sc-lbl">{s.l}</div><div className="sc-val" style={{ color: s.c }}>{s.v}</div></div>
            ))}
          </div>
          <div className="coin">
            <div className="coin-l"><div className="coin-em">🪙</div><div><div className="coin-t">Swacchata Coins</div><div className="coin-v">{profile.coins_total.toLocaleString()}</div><div className="coin-m">+{profile.coins_month} this month</div></div></div>
            <button className="rpbtn" onClick={() => router.push("/report")}>+ Report Issue</button>
          </div>
          <div className="sh">
            <div className="sh-t">My Complaints</div>
            <div className="tabs">
              {[["all","All"],["active","Active"],["resolved","Resolved"],["pending","Pending"]].map(([id, label]) => (
                <button key={id} className={`tab${tab === id ? " on" : ""}`} onClick={() => setTab(id)}>{label}</button>
              ))}
            </div>
          </div>
          <div className="list">
            {filtered.length === 0
              ? <div className="empty"><div style={{ fontSize: "2rem", marginBottom: ".5rem" }}>📋</div><p>No complaints here.</p></div>
              : filtered.map(c => {
                  const sc = S[c.status] ?? S.pending;
                  const pc = c.ai_priority ? P[c.ai_priority] : null;
                  return (
                    <div key={c.id} className="cc" onClick={() => router.push(`/complaints/${c.id}`)}>
                      <div className="cc-top">
                        <div>
                          <div className="cc-title">{c.title ?? c.description?.slice(0, 60) ?? "Untitled"}</div>
                          <div className="cc-meta">{c.ai_category ?? "Uncategorised"}{c.address ? ` · ${c.address.split(",")[0]}` : ""} · {timeAgo(c.created_at)}</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: ".3rem", alignItems: "flex-end" }}>
                          <span className="pill" style={{ color: sc.c, background: sc.bg }}>{sc.label}</span>
                          {pc && <span className="pill" style={{ color: pc.c, background: "rgba(0,0,0,.2)" }}><span className="pdot" style={{ background: pc.dot }} />{c.ai_priority}</span>}
                        </div>
                      </div>
                      {c.description && <div className="cc-desc">{c.description}</div>}
                    </div>
                  );
                })
            }
          </div>
        </main>
        <button className="fab" onClick={() => router.push("/report")} aria-label="Report issue">+</button>
      </div>
    </>
  );
}
