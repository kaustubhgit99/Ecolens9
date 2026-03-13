"use client";

import { useState, useRef, useCallback, useTransition, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function ReportPage() {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTx] = useTransition();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [address, setAddress] = useState("");
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) { alert("Max 10 MB"); return; }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setImageFile(file);
  }, [previewUrl]);

  const fetchLocation = () => {
    if (!navigator.geolocation) { setLocError("Geolocation not supported."); return; }
    setLocLoading(true); setLocError(null);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude); setLng(longitude);
        let addr = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`, { headers: { "Accept-Language": "en" } });
          if (r.ok) { const d = await r.json(); addr = d.display_name ?? addr; }
        } catch {}
        setAddress(addr); setLocLoading(false);
      },
      err => { setLocError(err.code === 1 ? "Location denied." : "Could not get location."); setLocLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const canProceed = step === 1 ? !!previewUrl : step === 2 ? !!description.trim() && lat !== null : true;

  const handleSubmit = () => {
    setError(null);
    startTx(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/login"); return; }
        let image_url: string | null = null;
        if (imageFile) {
          const path = `${user.id}/${Date.now()}_${imageFile.name.replace(/\s/g, "_")}`;
          const { error: upErr } = await supabase.storage.from("complaint-images").upload(path, imageFile, { upsert: false });
          if (upErr) throw upErr;
          image_url = supabase.storage.from("complaint-images").getPublicUrl(path).data.publicUrl;
        }
        const { data: complaint, error: insertErr } = await supabase.from("complaints").insert({
          citizen_id: user.id, title: title.trim() || null, description: description.trim(),
          image_url, latitude: lat!, longitude: lng!, address: address || null,
          status: "pending", ai_is_spam: false, ai_is_duplicate: false, coins_awarded: false, ai_objects: [],
        }).select("id").single();
        if (insertErr) throw insertErr;
        setSuccessId(complaint.id);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Submission failed.");
      }
    });
  };

  const reset = () => { setSuccessId(null); setStep(1); setImageFile(null); setPreviewUrl(null); setTitle(""); setDescription(""); setLat(null); setLng(null); setAddress(""); };

  if (successId) return (
    <>
      <style>{CSS}</style>
      <div className="success-pg">
        <div className="success-card">
          <div style={{ fontSize: "3rem", marginBottom: ".75rem" }}>🌱</div>
          <h2>Submitted!</h2>
          <p>Your complaint is received. AI verification starts shortly.</p>
          <div className="s-id"><span>ID</span><code>{successId.slice(0, 8).toUpperCase()}</code></div>
          <div className="coin-note">🪙 Earn Swacchata Coins once verified!</div>
          <button className="btn-next w100" style={{ marginTop: ".75rem" }} onClick={() => router.push("/dashboard")}>View Dashboard</button>
          <button className="btn-back w100" style={{ marginTop: ".4rem" }} onClick={reset}>Report Another</button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="rp">
        <header className="rp-head">
          <div style={{ display: "flex", alignItems: "center", gap: ".75rem", marginBottom: ".85rem" }}>
            <button className="back" onClick={() => router.push("/dashboard")}>←</button>
            <div><div style={{ fontSize: "1rem", fontWeight: 700 }}>Report an Issue</div><div style={{ fontSize: ".68rem", color: "#2ECC71", textTransform: "uppercase", letterSpacing: ".08em" }}>EcoLens · Amravati</div></div>
          </div>
          <div className="progress">
            {["Photo","Details","Submit"].map((l, i) => {
              const n = i + 1;
              return (
                <div key={l} className={`p-item${step === n ? " p-on" : step > n ? " p-done" : ""}`}>
                  <div className="p-bubble">{step > n ? "✓" : n}</div>
                  <span className="p-lbl">{l}</span>
                  {i < 2 && <div className="p-line" />}
                </div>
              );
            })}
          </div>
        </header>

        <main className="rp-main">
          {step === 1 && (
            <div className="step">
              <div className="step-h"><span style={{ fontSize: "1.8rem" }}>📷</span><div><h2>Capture the Issue</h2><p>Take or upload a photo</p></div></div>
              {!previewUrl
                ? <div className="dropzone" tabIndex={0} role="button" onClick={() => fileRef.current?.click()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) processFile(f); }}
                    onDragOver={e => e.preventDefault()} onKeyDown={e => e.key === "Enter" && fileRef.current?.click()}>
                    <div style={{ fontSize: "2.5rem" }}>🌿</div>
                    <div style={{ fontWeight: 600, marginTop: ".5rem" }}>Drop photo here</div>
                    <div style={{ fontSize: ".75rem", color: "#475569", marginTop: ".25rem" }}>or tap to browse · max 10 MB</div>
                    <div style={{ margin: ".5rem 0", fontSize: ".7rem", color: "#334155", textTransform: "uppercase", letterSpacing: ".1em" }}>or</div>
                    <button className="btn-cam" type="button" onClick={e => { e.stopPropagation(); camRef.current?.click(); }}>📷 Open Camera</button>
                  </div>
                : <div className="preview-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="Preview" className="preview-img" />
                    <div className="preview-actions">
                      <button className="btn-change" onClick={() => fileRef.current?.click()}>Change</button>
                      <button className="btn-rm" onClick={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); setImageFile(null); }}>✕</button>
                    </div>
                    <div className="preview-badge">✓ Ready</div>
                  </div>
              }
              <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }} />
              <input ref={camRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }} />
            </div>
          )}

          {step === 2 && (
            <div className="step">
              <div className="step-h"><span style={{ fontSize: "1.8rem" }}>📍</span><div><h2>Add Details</h2><p>Describe and confirm location</p></div></div>
              <div className="field"><label className="lbl">Title <span style={{ color: "#475569", fontWeight: 400 }}>(optional)</span></label><input className="inp" type="text" placeholder="e.g. Garbage near bus stop" value={title} onChange={e => setTitle(e.target.value)} maxLength={100} /></div>
              <div className="field">
                <label className="lbl">Description <span style={{ color: "#EF4444" }}>*</span></label>
                <textarea className="inp" rows={4} maxLength={500} placeholder="Describe the issue." value={description} onChange={e => setDescription(e.target.value)} style={{ resize: "vertical", minHeight: "90px", lineHeight: "1.5" }} />
                <span style={{ fontSize: ".68rem", color: "#334155", textAlign: "right" }}>{description.length}/500</span>
              </div>
              <div className="field">
                <label className="lbl">Location <span style={{ color: "#EF4444" }}>*</span></label>
                {lat !== null
                  ? <div className="loc-found"><span>📍</span><div style={{ flex: 1 }}><div style={{ fontSize: ".82rem", color: "#2ECC71", fontWeight: 600 }}>Location captured</div><div style={{ fontSize: ".7rem", color: "#64748B" }}>{address}</div></div><button className="loc-retry" onClick={fetchLocation}>↻</button></div>
                  : <><button className="btn-loc" type="button" onClick={fetchLocation} disabled={locLoading}>{locLoading ? "⏳ Detecting…" : "📡 Use My Location"}</button>{locError && <p style={{ fontSize: ".78rem", color: "#FCA5A5", marginTop: ".3rem" }}>{locError}</p>}</>
                }
                <input className="inp" style={{ marginTop: ".5rem" }} type="text" placeholder="Or type address manually" value={address} onChange={e => setAddress(e.target.value)} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="step">
              <div className="step-h"><span style={{ fontSize: "1.8rem" }}>✅</span><div><h2>Review &amp; Submit</h2><p>Confirm details</p></div></div>
              <div className="summary-card">
                {previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Complaint" className="summary-img" />
                )}
                <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: ".65rem" }}>
                  {[{ icon: "📝", label: "Description", val: description }, ...(title ? [{ icon: "🏷️", label: "Title", val: title }] : []), { icon: "📍", label: "Location", val: address || `${lat?.toFixed(5)}, ${lng?.toFixed(5)}` }].map(r => (
                    <div key={r.label} style={{ display: "flex", gap: ".55rem" }}><span>{r.icon}</span><div><div style={{ fontSize: ".62rem", color: "#475569", textTransform: "uppercase", letterSpacing: ".06em" }}>{r.label}</div><div style={{ fontSize: ".84rem", color: "#F8FAFC", marginTop: "2px" }}>{r.val}</div></div></div>
                  ))}
                </div>
                <div style={{ padding: ".75rem 1rem", background: "rgba(46,204,113,.06)", borderTop: "1px solid rgba(46,204,113,.12)", fontSize: ".78rem", color: "#86EFAC" }}>🤖 AI will verify and route your complaint within 60 seconds.</div>
              </div>
              {error && <div className="submit-err">⚠️ {error}</div>}
            </div>
          )}
        </main>

        <footer className="rp-foot">
          <div className="foot-inner">
            {step > 1
              ? <button className="btn-back" onClick={() => setStep(s => s - 1)} disabled={isPending}>← Back</button>
              : <div />
            }
            {step < 3
              ? <button className="btn-next" onClick={() => setStep(s => s + 1)} disabled={!canProceed}>Continue →</button>
              : <button className="btn-next" onClick={handleSubmit} disabled={isPending || !canProceed}>{isPending ? "Submitting…" : "Submit ✈"}</button>
            }
          </div>
        </footer>
      </div>
    </>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');
  @keyframes stepIn{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:#0F172A;color:#F8FAFC;font-family:'DM Sans',sans-serif}
  .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
  .rp{min-height:100vh;display:flex;flex-direction:column;background:#0F172A}
  .rp-head{background:rgba(30,41,59,.97);border-bottom:1px solid rgba(46,204,113,.12);padding:1rem 1.25rem 0;position:sticky;top:0;z-index:10}
  .back{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:#94A3B8;cursor:pointer;display:flex;align-items:center;justify-content:center}
  .back:hover{background:rgba(255,255,255,.1);color:#F8FAFC}
  .progress{display:flex;align-items:center;padding-bottom:.85rem}
  .p-item{display:flex;align-items:center;gap:.4rem;flex:1}
  .p-bubble{width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.1);color:#64748B;font-size:.72rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .3s}
  .p-on .p-bubble{background:rgba(46,204,113,.15);border-color:#2ECC71;color:#2ECC71;box-shadow:0 0 12px rgba(46,204,113,.3)}
  .p-done .p-bubble{background:#2ECC71;border-color:#2ECC71;color:#0F172A}
  .p-lbl{font-size:.72rem;font-weight:500;color:#475569;transition:color .3s}
  .p-on .p-lbl{color:#2ECC71}
  .p-line{flex:1;height:1.5px;background:rgba(255,255,255,.07);margin:0 .4rem}
  .rp-main{flex:1;overflow-y:auto;padding:1.25rem}
  .step{display:flex;flex-direction:column;gap:1.25rem;max-width:540px;margin:0 auto;animation:stepIn .25s ease both}
  .step-h{display:flex;align-items:flex-start;gap:.75rem}
  .step-h h2{font-size:1.1rem;font-weight:700;margin:0 0 .2rem;letter-spacing:-.02em}
  .step-h p{font-size:.8rem;color:#64748B;margin:0}
  .dropzone{border:2px dashed rgba(46,204,113,.25);border-radius:14px;padding:2.5rem 1.5rem;text-align:center;cursor:pointer;transition:all .25s;background:rgba(46,204,113,.03);display:flex;flex-direction:column;align-items:center}
  .dropzone:hover,.dropzone:focus{border-color:rgba(46,204,113,.5);background:rgba(46,204,113,.06);outline:none}
  .btn-cam{background:rgba(46,204,113,.1);border:1px solid rgba(46,204,113,.3);color:#2ECC71;border-radius:8px;padding:.45rem 1rem;font-size:.82rem;font-weight:600;cursor:pointer;margin-top:.5rem;font-family:inherit}
  .preview-wrap{position:relative;border-radius:12px;overflow:hidden;border:1px solid rgba(46,204,113,.2);aspect-ratio:4/3;background:#0F172A}
  .preview-img{width:100%;height:100%;object-fit:cover;display:block}
  .preview-actions{position:absolute;top:.5rem;right:.5rem;display:flex;gap:.4rem}
  .btn-change{background:rgba(15,23,42,.8);border:1px solid rgba(255,255,255,.1);color:#F8FAFC;border-radius:6px;padding:.3rem .6rem;font-size:.72rem;cursor:pointer;font-family:inherit}
  .btn-rm{width:30px;height:30px;border-radius:6px;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);color:#FCA5A5;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-family:inherit}
  .preview-badge{position:absolute;bottom:.6rem;left:.6rem;background:rgba(46,204,113,.9);color:#0F172A;border-radius:20px;padding:.25rem .65rem;font-size:.7rem;font-weight:700}
  .field{display:flex;flex-direction:column;gap:.4rem}
  .lbl{font-size:.78rem;font-weight:600;color:#94A3B8}
  .inp{background:rgba(15,23,42,.7);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:.65rem .85rem;color:#F8FAFC;font-size:.88rem;font-family:inherit;outline:none;transition:border-color .2s,box-shadow .2s;width:100%}
  .inp::placeholder{color:#334155}
  .inp:focus{border-color:rgba(46,204,113,.45);box-shadow:0 0 0 3px rgba(46,204,113,.09)}
  .btn-loc{width:100%;display:flex;align-items:center;justify-content:center;gap:.5rem;background:rgba(14,165,233,.08);border:1px solid rgba(14,165,233,.25);color:#38BDF8;border-radius:10px;padding:.65rem 1rem;font-size:.88rem;font-weight:600;font-family:inherit;cursor:pointer;transition:all .2s}
  .btn-loc:disabled{opacity:.6;cursor:not-allowed}
  .loc-found{display:flex;align-items:flex-start;gap:.6rem;background:rgba(46,204,113,.06);border:1px solid rgba(46,204,113,.2);border-radius:10px;padding:.75rem}
  .loc-retry{background:none;border:none;color:#64748B;cursor:pointer;font-size:1rem;padding:0 .25rem;font-family:inherit}
  .summary-card{background:rgba(30,41,59,.7);border:1px solid rgba(255,255,255,.07);border-radius:14px;overflow:hidden}
  .summary-img{width:100%;max-height:200px;object-fit:cover;display:block;border-bottom:1px solid rgba(255,255,255,.06)}
  .submit-err{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:9px;padding:.65rem .85rem;color:#FCA5A5;font-size:.82rem}
  .rp-foot{background:rgba(15,23,42,.97);border-top:1px solid rgba(255,255,255,.06);padding:.85rem 1.25rem;position:sticky;bottom:0}
  .foot-inner{display:flex;justify-content:space-between;align-items:center;max-width:540px;margin:0 auto;gap:1rem}
  .btn-back{display:flex;align-items:center;gap:.35rem;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:#94A3B8;border-radius:10px;padding:.6rem 1rem;font-size:.85rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s}
  .btn-back:disabled{opacity:.4;cursor:not-allowed}
  .btn-next{background:#2ECC71;color:#0F172A;border:none;border-radius:10px;padding:.65rem 1.4rem;font-size:.88rem;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s}
  .btn-next:hover:not(:disabled){background:#27ae60;transform:translateY(-1px);box-shadow:0 4px 18px rgba(46,204,113,.3)}
  .btn-next:disabled{opacity:.4;cursor:not-allowed}
  .success-pg{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0F172A;padding:1.5rem}
  .success-card{width:100%;max-width:400px;text-align:center;background:rgba(30,41,59,.85);border:1px solid rgba(46,204,113,.2);border-radius:20px;padding:2rem;box-shadow:0 0 60px rgba(46,204,113,.1)}
  .success-card h2{font-size:1.35rem;font-weight:700;margin:0 0 .5rem}
  .success-card p{font-size:.85rem;color:#64748B;margin:0 0 1.25rem;line-height:1.6}
  .s-id{display:flex;align-items:center;justify-content:space-between;background:rgba(15,23,42,.6);border:1px solid rgba(255,255,255,.06);border-radius:9px;padding:.6rem .85rem;margin-bottom:.65rem}
  .s-id span{font-size:.7rem;color:#64748B;text-transform:uppercase;letter-spacing:.06em}
  .s-id code{font-size:.85rem;color:#2ECC71;font-family:monospace;font-weight:700}
  .coin-note{font-size:.8rem;color:#FCD34D;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:8px;padding:.5rem .85rem;margin-bottom:.25rem}
  .w100{width:100%}
`;
