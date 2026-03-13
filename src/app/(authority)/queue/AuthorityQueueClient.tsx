"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Profile = { id: string; full_name: string; role: string; department: string | null; ward: string | null };
type Complaint = { id: string; title: string | null; description: string | null; status: string; ai_priority: string | null; ai_category: string | null; ai_department: string | null; ai_confidence: number | null; address: string | null; ward: string | null; department: string | null; created_at: string; resolved_at: string | null; citizen_id: string | null };
type Dept = { id: string; name: string; code: string; active: boolean };

const SC: Record<string, { label: string; c: string; bg: string }> = {
  pending:       { label: "Pending",     c: "#94A3B8", bg: "rgba(148,163,184,.1)" },
  ai_processing: { label: "Processing",  c: "#A78BFA", bg: "rgba(139,92,246,.1)" },
  rejected_spam: { label: "Rejected",    c: "#FCA5A5", bg: "rgba(239,68,68,.1)" },
  merged:        { label: "Merged",      c: "#FCD34D", bg: "rgba(245,158,11,.1)" },
  routed:        { label: "Routed",      c: "#86EFAC", bg: "rgba(46,204,113,.1)" },
  in_progress:   { label: "In Progress", c: "#FCD34D", bg: "rgba(245,158,11,.12)" },
  resolved:      { label: "Resolved",    c: "#6EE7B7", bg: "rgba(16,185,129,.12)" },
};
const PC: Record<string, { c: string; dot: string; bg: string }> = {
  High:   { c: "#FCA5A5", dot: "#EF4444", bg: "rgba(239,68,68,.12)" },
  Medium: { c: "#FCD34D", dot: "#F59E0B", bg: "rgba(245,158,11,.12)" },
  Low:    { c: "#93C5FD", dot: "#3B82F6", bg: "rgba(59,130,246,.12)" },
};
const PRI_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

function timeAgo(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return `${Math.floor((Date.now() - new Date(iso).getTime()) / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AuthorityQueueClient({ profile, complaints: init, departments }: { profile: Profile; complaints: Complaint[]; departments: Dept[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTx] = useTransition();
  const [complaints, setComplaints] = useState<Complaint[]>(init);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fPri, setFPri] = useState("All");
  const [fStatus, setFStatus] = useState("All");
  const [fDept, setFDept] = useState("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"priority" | "created_at">("priority");
  const [toast, setToast] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const logout = async () => { setLoggingOut(true); await supabase.auth.signOut(); router.push("/login"); router.refresh(); };

  const updateStatus = (id: string, status: string) => {
    startTx(async () => {
      const body: Record<string, string> = { status };
      if (status === "resolved") body.resolution_notes = "Resolved by officer";
      const res = await fetch(`/api/complaints/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        const { data } = await res.json();
        setComplaints(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
        showToast(status === "resolved" ? "✅ Resolved!" : "✅ Updated");
        if (status === "resolved") setSelectedId(null);
      } else {
        const { error } = await res.json();
        showToast(`❌ ${error}`);
      }
    });
  };

  const filtered = useMemo(() => {
    let d = [...complaints];
    if (fPri !== "All") d = d.filter(c => c.ai_priority === fPri);
    if (fStatus !== "All") d = d.filter(c => c.status === fStatus);
    if (fDept !== "All") d = d.filter(c => c.department === fDept || c.ai_department === fDept);
    if (search) { const q = search.toLowerCase(); d = d.filter(c => (c.title ?? "").toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q) || (c.address ?? "").toLowerCase().includes(q)); }
    if (sortBy === "priority") d.sort((a, b) => (PRI_ORDER[a.ai_priority ?? ""] ?? 3) - (PRI_ORDER[b.ai_priority ?? ""] ?? 3));
    else d.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return d;
  }, [complaints, fPri, fStatus, fDept, search, sortBy]);

  const stats = { total: complaints.length, high: complaints.filter(c => c.ai_priority === "High" && c.status !== "resolved").length, active: complaints.filter(c => c.status === "in_progress").length, resolved: complaints.filter(c => c.status === "resolved").length };
  const selected = selectedId ? complaints.find(c => c.id === selectedId) ?? null : null;

  return (
    <>
      <style>{CSS}</style>
      <div className="aq">
        {toast && <div className="toast">{toast}</div>}
        <aside className="sidebar">
          <div className="s-brand"><span style={{ fontSize: "1.3rem" }}>🌿</span><div><div className="s-name">EcoLens</div><div className="s-role">Authority Panel</div></div></div>
          <nav className="s-nav">
            {[["📋","Complaint Queue",true],["🗺️","Heatmap",false],["📊","Analytics",false],["📁","History",false]].map(([icon,label,active]) => (
              <div key={label as string} className={`nav-item${active ? " nav-on" : ""}`}><span>{icon}</span><span>{label}</span></div>
            ))}
          </nav>
          <div style={{ padding: ".75rem 1rem", borderTop: "1px solid rgba(255,255,255,.05)", marginTop: "auto" }}>
            <div style={{ fontSize: ".62rem", color: "#334155", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: ".35rem" }}>Department</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: ".35rem", background: "rgba(46,204,113,.08)", border: "1px solid rgba(46,204,113,.2)", color: "#2ECC71", borderRadius: "20px", padding: ".3rem .65rem", fontSize: ".75rem", fontWeight: 600 }}>🏛️ {profile.department ?? "All Depts"}</div>
          </div>
          <div className="s-user">
            <div className="s-avatar">{profile.full_name.slice(0, 2).toUpperCase()}</div>
            <div><div className="s-uname">{profile.full_name}</div><div className="s-urole">{profile.role}</div></div>
            <button className="logout-sm" onClick={logout} disabled={loggingOut} title="Sign out">⏻</button>
          </div>
        </aside>

        <div className="aq-body">
          <header className="topbar">
            <div><h1 className="tb-title">Complaint Queue</h1><p className="tb-sub">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p></div>
            {stats.high > 0 && <div className="hi-badge">🔴 {stats.high} High Priority</div>}
          </header>

          <div className="stat-strip">
            {[["📋","Total",stats.total,"#94A3B8"],["🔴","High",stats.high,"#EF4444"],["⏳","Active",stats.active,"#F59E0B"],["✅","Resolved",stats.resolved,"#2ECC71"]].map(([icon, label, val, c]) => (
              <div className="stat-card" key={label as string}><span className="stat-icon">{icon}</span><div><div className="stat-val" style={{ color: c as string }}>{val}</div><div className="stat-lbl">{label}</div></div></div>
            ))}
          </div>

          <div className="filter-bar">
            <div className="search-wrap"><span className="search-icon">🔍</span><input className="search-inp" type="search" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
              <select className="fsel" value={fPri} onChange={e => setFPri(e.target.value)}><option value="All">All Priorities</option>{["High","Medium","Low"].map(p => <option key={p} value={p}>{p}</option>)}</select>
              <select className="fsel" value={fStatus} onChange={e => setFStatus(e.target.value)}><option value="All">All Statuses</option>{Object.entries(SC).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
              <select className="fsel" value={fDept} onChange={e => setFDept(e.target.value)}><option value="All">All Depts</option>{departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}</select>
              <select className="fsel" value={sortBy} onChange={e => setSortBy(e.target.value as "priority" | "created_at")}><option value="priority">Sort: Priority</option><option value="created_at">Sort: Newest</option></select>
            </div>
          </div>

          <div className="result-row">Showing <strong>{filtered.length}</strong> of {complaints.length}</div>

          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Priority</th><th>Complaint</th><th className="hide-sm">Dept</th><th>Status</th><th className="hide-sm">When</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan={6} className="empty-row">🔍 No complaints match filters.</td></tr>
                  : filtered.map(c => {
                      const sc = SC[c.status] ?? SC.pending;
                      const pc = c.ai_priority ? PC[c.ai_priority] : null;
                      const isSel = selectedId === c.id;
                      return (
                        <tr key={c.id} className={`crow${isSel ? " crow-sel" : ""}`} onClick={() => setSelectedId(isSel ? null : c.id)} tabIndex={0} onKeyDown={e => e.key === "Enter" && setSelectedId(isSel ? null : c.id)}>
                          <td>{pc ? <span className="pill" style={{ color: pc.c, background: pc.bg }}><span className="pdot" style={{ background: pc.dot }} />{c.ai_priority}</span> : <span style={{ color: "#475569", fontSize: ".72rem" }}>—</span>}</td>
                          <td><div className="c-title">{c.title ?? c.description?.slice(0, 55) ?? "Untitled"}</div><div className="c-sub">{c.ai_category ?? "—"}{c.address ? ` · ${c.address.split(",")[0]}` : ""}</div></td>
                          <td className="hide-sm"><span style={{ fontSize: ".72rem", color: "#64748B" }}>{c.department ?? c.ai_department ?? "—"}</span></td>
                          <td><span className="pill" style={{ color: sc.c, background: sc.bg }}>{sc.label}</span></td>
                          <td className="hide-sm"><span style={{ fontSize: ".7rem", color: "#475569", fontFamily: "monospace" }}>{timeAgo(c.created_at)}</span></td>
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: "flex", gap: ".35rem" }}>
                              {c.status !== "in_progress" && c.status !== "resolved" && <button className="act-btn act-prog" disabled={isPending} onClick={() => updateStatus(c.id, "in_progress")}>Start</button>}
                              {c.status !== "resolved" && <button className="act-btn act-res" disabled={isPending} onClick={() => updateStatus(c.id, "resolved")}>Resolve</button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                }
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <aside className="detail-panel">
            <div className="dp-head"><span className="dp-title">Details</span><button className="dp-close" onClick={() => setSelectedId(null)}>✕</button></div>
            <div className="dp-body">
              <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap", marginBottom: ".75rem" }}>
                {selected.ai_priority && (() => { const pc = PC[selected.ai_priority]; return <span className="pill" style={{ color: pc.c, background: pc.bg }}><span className="pdot" style={{ background: pc.dot }} />{selected.ai_priority}</span>; })()}
                {(() => { const sc = SC[selected.status] ?? SC.pending; return <span className="pill" style={{ color: sc.c, background: sc.bg }}>{sc.label}</span>; })()}
              </div>
              <div className="dp-complaint-title">{selected.title ?? "Untitled"}</div>
              <div className="dp-id">ID: <code>{selected.id.slice(0, 8).toUpperCase()}</code></div>
              {[["📝","Description",selected.description ?? "—"],["📍","Address",selected.address ?? "—"],["🏘️","Ward",selected.ward ?? "—"],["🏛️","Dept",selected.department ?? selected.ai_department ?? "—"],["🤖","AI Category",selected.ai_category ?? "—"],["🕐","Submitted",new Date(selected.created_at).toLocaleString("en-IN")]].map(([icon,label,val]) => (
                <div key={label} className="dp-row"><span className="dp-icon">{icon}</span><div><div className="dp-lbl">{label}</div><div className="dp-val">{val}</div></div></div>
              ))}
            </div>
            {selected.status !== "resolved" && (
              <div className="dp-actions">
                {selected.status !== "in_progress" && <button className="dp-btn dp-prog" disabled={isPending} onClick={() => updateStatus(selected.id, "in_progress")}>⏳ Mark In Progress</button>}
                <button className="dp-btn dp-res" disabled={isPending} onClick={() => updateStatus(selected.id, "resolved")}>✅ Mark Resolved</button>
              </div>
            )}
          </aside>
        )}
      </div>
    </>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=IBM+Plex+Mono:wght@500&display=swap');
  @keyframes toastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:#0F172A;color:#F8FAFC;font-family:'DM Sans',sans-serif}
  .aq{min-height:100vh;display:flex;background:#0F172A;position:relative}
  .toast{position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);background:rgba(30,41,59,.97);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:.6rem 1.25rem;font-size:.82rem;color:#F8FAFC;z-index:100;animation:toastIn .2s ease;box-shadow:0 8px 24px rgba(0,0,0,.4);white-space:nowrap}
  .sidebar{width:220px;flex-shrink:0;background:rgba(15,23,42,.98);border-right:1px solid rgba(255,255,255,.05);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow-y:auto}
  .s-brand{display:flex;align-items:center;gap:.65rem;padding:1.25rem 1rem;border-bottom:1px solid rgba(255,255,255,.05)}
  .s-name{font-size:.95rem;font-weight:700;color:#F8FAFC}
  .s-role{font-size:.65rem;color:#2ECC71;text-transform:uppercase;letter-spacing:.1em}
  .s-nav{padding:.75rem .5rem;flex:1;display:flex;flex-direction:column;gap:2px}
  .nav-item{display:flex;align-items:center;gap:.6rem;padding:.55rem .75rem;border-radius:8px;color:#64748B;font-size:.82rem;cursor:pointer;transition:all .2s}
  .nav-item:hover{background:rgba(255,255,255,.05);color:#94A3B8}
  .nav-on{background:rgba(46,204,113,.1);color:#2ECC71;box-shadow:inset 3px 0 0 #2ECC71}
  .s-user{display:flex;align-items:center;gap:.6rem;padding:.85rem 1rem;border-top:1px solid rgba(255,255,255,.05)}
  .s-avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#2ECC71,#0EA5E9);color:#0F172A;font-weight:700;font-size:.72rem;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .s-uname{font-size:.78rem;font-weight:600;color:#F8FAFC}
  .s-urole{font-size:.62rem;color:#475569;text-transform:capitalize}
  .logout-sm{margin-left:auto;background:none;border:none;color:#475569;cursor:pointer;font-size:.9rem;padding:4px;font-family:inherit}
  .logout-sm:hover{color:#FCA5A5}
  .aq-body{flex:1;min-width:0;display:flex;flex-direction:column}
  .topbar{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid rgba(255,255,255,.05);background:rgba(15,23,42,.9);position:sticky;top:0;z-index:5}
  .tb-title{font-size:1.1rem;font-weight:700;letter-spacing:-.02em}
  .tb-sub{font-size:.7rem;color:#475569;font-family:'IBM Plex Mono',monospace}
  .hi-badge{background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:#FCA5A5;border-radius:20px;padding:.3rem .75rem;font-size:.75rem;font-weight:700}
  .stat-strip{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid rgba(255,255,255,.05)}
  .stat-card{display:flex;align-items:center;gap:.65rem;padding:.85rem 1.25rem;border-right:1px solid rgba(255,255,255,.04)}
  .stat-icon{font-size:1.2rem}
  .stat-val{font-size:1.35rem;font-weight:700;font-family:'IBM Plex Mono',monospace;line-height:1}
  .stat-lbl{font-size:.65rem;color:#475569;text-transform:uppercase;letter-spacing:.06em;margin-top:2px}
  .filter-bar{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;padding:.85rem 1.25rem;border-bottom:1px solid rgba(255,255,255,.04);background:rgba(30,41,59,.4)}
  .search-wrap{position:relative;flex:1;min-width:160px}
  .search-icon{position:absolute;left:.7rem;top:50%;transform:translateY(-50%);font-size:.78rem;pointer-events:none}
  .search-inp{width:100%;background:rgba(15,23,42,.7);border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:.5rem .75rem .5rem 2rem;color:#F8FAFC;font-size:.82rem;font-family:inherit;outline:none}
  .search-inp::placeholder{color:#334155}
  .search-inp:focus{border-color:rgba(46,204,113,.35)}
  .fsel{background:rgba(15,23,42,.7);border:1px solid rgba(255,255,255,.07);color:#94A3B8;border-radius:7px;padding:.45rem .65rem;font-size:.76rem;font-family:inherit;outline:none;cursor:pointer}
  .result-row{padding:.5rem 1.25rem;font-size:.75rem;color:#475569}
  .result-row strong{color:#94A3B8}
  .table-wrap{flex:1;overflow-x:auto}
  .tbl{width:100%;border-collapse:collapse;font-size:.82rem}
  .tbl thead tr{background:rgba(30,41,59,.6);border-bottom:1px solid rgba(255,255,255,.06)}
  .tbl th{padding:.65rem 1rem;text-align:left;font-size:.66rem;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.07em;white-space:nowrap}
  .crow{border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;transition:background .15s}
  .crow:hover{background:rgba(255,255,255,.025)}
  .crow-sel{background:rgba(46,204,113,.04) !important;border-left:3px solid #2ECC71}
  .tbl td{padding:.75rem 1rem;vertical-align:middle}
  .pill{display:inline-flex;align-items:center;gap:.3rem;border-radius:20px;padding:.2rem .6rem;font-size:.7rem;font-weight:700;white-space:nowrap}
  .pdot{width:5px;height:5px;border-radius:50%;flex-shrink:0}
  .c-title{font-size:.84rem;font-weight:600;color:#F8FAFC;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px}
  .c-sub{font-size:.7rem;color:#475569;margin-top:2px}
  .act-btn{padding:.28rem .6rem;border-radius:6px;font-size:.7rem;font-weight:600;border:1px solid;cursor:pointer;transition:all .2s;font-family:inherit}
  .act-prog{background:rgba(245,158,11,.08);border-color:rgba(245,158,11,.25);color:#FCD34D}
  .act-prog:hover:not(:disabled){background:rgba(245,158,11,.15)}
  .act-res{background:rgba(46,204,113,.08);border-color:rgba(46,204,113,.25);color:#2ECC71}
  .act-res:hover:not(:disabled){background:rgba(46,204,113,.15)}
  .act-btn:disabled{opacity:.4;cursor:not-allowed}
  .empty-row{text-align:center;padding:3rem;color:#475569;font-size:.85rem}
  .detail-panel{width:280px;flex-shrink:0;background:rgba(15,23,42,.98);border-left:1px solid rgba(255,255,255,.05);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow-y:auto}
  .dp-head{display:flex;align-items:center;justify-content:space-between;padding:1rem;border-bottom:1px solid rgba(255,255,255,.06);position:sticky;top:0;background:rgba(15,23,42,.98);z-index:1}
  .dp-title{font-size:.85rem;font-weight:700}
  .dp-close{background:rgba(255,255,255,.06);border:none;color:#64748B;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:.72rem;display:flex;align-items:center;justify-content:center;font-family:inherit}
  .dp-close:hover{background:rgba(255,255,255,.1);color:#F8FAFC}
  .dp-body{padding:.85rem;display:flex;flex-direction:column;gap:.65rem;flex:1}
  .dp-complaint-title{font-size:.9rem;font-weight:700;line-height:1.4}
  .dp-id{font-size:.68rem;color:#334155;font-family:'IBM Plex Mono',monospace}
  .dp-id code{color:#475569}
  .dp-row{display:flex;gap:.55rem;align-items:flex-start}
  .dp-icon{font-size:.88rem;flex-shrink:0;margin-top:1px}
  .dp-lbl{font-size:.62rem;color:#475569;text-transform:uppercase;letter-spacing:.06em}
  .dp-val{font-size:.78rem;color:#94A3B8;line-height:1.45;margin-top:1px}
  .dp-actions{padding:.85rem;border-top:1px solid rgba(255,255,255,.05);display:flex;flex-direction:column;gap:.4rem;position:sticky;bottom:0;background:rgba(15,23,42,.98)}
  .dp-btn{width:100%;padding:.55rem;border-radius:8px;font-size:.78rem;font-weight:600;font-family:inherit;cursor:pointer;transition:all .2s;border:1px solid}
  .dp-btn:disabled{opacity:.4;cursor:not-allowed}
  .dp-prog{background:rgba(245,158,11,.08);border-color:rgba(245,158,11,.25);color:#FCD34D}
  .dp-res{background:rgba(46,204,113,.1);border-color:rgba(46,204,113,.3);color:#2ECC71}
  @media(max-width:1100px){.detail-panel{display:none}}
  @media(max-width:900px){.stat-strip{grid-template-columns:repeat(2,1fr)}}
  @media(max-width:680px){.sidebar{display:none}.hide-sm{display:none !important}.stat-strip{grid-template-columns:repeat(2,1fr)}}
`;
