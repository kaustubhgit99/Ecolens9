"use client";

import { useState, useRef, useTransition, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

type AuthMode = "email_password" | "email_otp" | "phone_otp";

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0F172A" }} />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [isPending, startTx] = useTransition();
  const [mode, setMode] = useState<AuthMode>("email_password");
  const [step, setStep] = useState<"creds" | "otp">("creds");
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [info, setInfo] = useState<string | null>(null);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const clear = () => { setError(null); setInfo(null); };
  const otpValue = otp.join("");

  const handleEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault(); clear();
    startTx(async () => {
      if (isSignUp) {
        const { error: err } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
        if (err) return setError(err.message);
        setInfo("Check your email to confirm your account.");
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) return setError(err.message);
        router.push("/dashboard"); router.refresh();
      }
    });
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault(); clear();
    startTx(async () => {
      if (mode === "phone_otp") {
        const formatted = phone.startsWith("+") ? phone : `+91${phone}`;
        const { error: err } = await supabase.auth.signInWithOtp({ phone: formatted });
        if (err) return setError(err.message);
      } else {
        const { error: err } = await supabase.auth.signInWithOtp({ email });
        if (err) return setError(err.message);
      }
      setInfo("OTP sent!"); setStep("otp");
    });
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault(); clear();
    if (otpValue.length !== 6) return setError("Enter all 6 digits.");
    startTx(async () => {
      let result;
      if (mode === "phone_otp") {
        const formatted = phone.startsWith("+") ? phone : `+91${phone}`;
        result = await supabase.auth.verifyOtp({ phone: formatted, token: otpValue, type: "sms" });
      } else {
        result = await supabase.auth.verifyOtp({ email, token: otpValue, type: "email" });
      }
      if (result.error) return setError(result.error.message);
      router.push(searchParams.get("redirect") ?? "/dashboard"); router.refresh();
    });
  };

  const TABS = [
    { id: "email_password" as AuthMode, label: "Password", icon: "🔑" },
    { id: "email_otp" as AuthMode, label: "Email OTP", icon: "✉️" },
    { id: "phone_otp" as AuthMode, label: "Phone OTP", icon: "📱" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');
        @keyframes cardIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#0F172A;color:#F8FAFC;font-family:'DM Sans',sans-serif}
        .pg{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem;background:#0F172A}
        .card{width:100%;max-width:420px;background:rgba(30,41,59,.9);border:1px solid rgba(46,204,113,.15);border-radius:20px;padding:2rem;box-shadow:0 25px 60px rgba(0,0,0,.5);animation:cardIn .4s ease both}
        .brand{display:flex;align-items:center;gap:.75rem;margin-bottom:1.75rem}
        .logo{width:38px;height:38px;border-radius:50%;background:rgba(46,204,113,.15);display:flex;align-items:center;justify-content:center;font-size:1.2rem}
        .brand-name{font-size:1.2rem;font-weight:700;color:#F8FAFC}
        .brand-sub{font-size:.65rem;color:#2ECC71;text-transform:uppercase;letter-spacing:.1em}
        h2{font-size:1.25rem;font-weight:700;margin-bottom:.25rem}
        .sub{font-size:.82rem;color:#64748B;margin-bottom:1.25rem}
        .tabs{display:flex;gap:.3rem;background:rgba(15,23,42,.6);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:4px;margin-bottom:1.25rem}
        .tab{flex:1;padding:.4rem;background:none;border:none;border-radius:7px;cursor:pointer;font-size:.75rem;color:#64748B;font-family:inherit;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:.3rem}
        .tab:hover{color:#94A3B8;background:rgba(255,255,255,.04)}
        .tab.on{background:rgba(46,204,113,.12);color:#2ECC71;box-shadow:0 0 0 1px rgba(46,204,113,.25)}
        .alert{padding:.6rem .85rem;border-radius:8px;font-size:.82rem;margin-bottom:.85rem}
        .err{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);color:#FCA5A5}
        .ok{background:rgba(46,204,113,.08);border:1px solid rgba(46,204,113,.2);color:#86EFAC}
        .form{display:flex;flex-direction:column;gap:.85rem}
        .field{display:flex;flex-direction:column;gap:.35rem}
        .lbl{font-size:.75rem;font-weight:500;color:#94A3B8}
        .inp{background:rgba(15,23,42,.7);border:1px solid rgba(255,255,255,.08);border-radius:9px;padding:.62rem .85rem;color:#F8FAFC;font-size:.9rem;outline:none;transition:border-color .2s,box-shadow .2s;width:100%;font-family:inherit}
        .inp::placeholder{color:#475569}
        .inp:focus{border-color:rgba(46,204,113,.5);box-shadow:0 0 0 3px rgba(46,204,113,.1)}
        .phone-row{display:flex;gap:.4rem;align-items:center}
        .prefix{padding:.62rem .75rem;background:rgba(15,23,42,.7);border:1px solid rgba(255,255,255,.08);border-radius:9px;color:#94A3B8;font-size:.82rem;white-space:nowrap}
        .otp-wrap{display:flex;gap:.5rem;justify-content:center;margin:.25rem 0}
        .otp-box{width:46px;height:54px;background:rgba(15,23,42,.7);border:1.5px solid rgba(255,255,255,.08);border-radius:10px;text-align:center;font-size:1.3rem;font-weight:700;color:#F8FAFC;outline:none;caret-color:#2ECC71;font-family:inherit;transition:all .2s}
        .otp-box:focus{border-color:#2ECC71;box-shadow:0 0 0 3px rgba(46,204,113,.15)}
        .btn{width:100%;padding:.68rem;font-weight:700;font-size:.9rem;border:none;border-radius:10px;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:.5rem;min-height:44px;font-family:inherit}
        .btn-g{background:#2ECC71;color:#0F172A}
        .btn-g:hover:not(:disabled){background:#27ae60;transform:translateY(-1px);box-shadow:0 4px 18px rgba(46,204,113,.35)}
        .btn-g:disabled{opacity:.55;cursor:not-allowed}
        .btn-ghost{background:none;color:#64748B;font-size:.8rem;padding:.5rem}
        .btn-ghost:hover{color:#94A3B8}
        .spinner{animation:spin .8s linear infinite;display:inline-block}
        .footer{font-size:.72rem;color:#475569;text-align:center;margin-top:.5rem}
        .link{color:#2ECC71;text-decoration:none}
      `}</style>
      <div className="pg">
        <main className="card">
          <div className="brand">
            <div className="logo">🌿</div>
            <div>
              <div className="brand-name">EcoLens</div>
              <div className="brand-sub">Amravati Civic Platform</div>
            </div>
          </div>
          <h2>{step === "otp" ? "Enter OTP" : isSignUp ? "Create account" : "Welcome back"}</h2>
          <p className="sub">{step === "otp" ? `Sent to your ${mode === "phone_otp" ? "phone" : "email"}` : "Report civic issues · Earn Swacchata Coins"}</p>
          {step === "creds" && (
            <div className="tabs">
              {TABS.map(t => (
                <button key={t.id} className={`tab${mode === t.id ? " on" : ""}`} onClick={() => { setMode(t.id); clear(); }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          )}
          {error && <div className="alert err">⚠️ {error}</div>}
          {info && <div className="alert ok">✅ {info}</div>}
          {step === "creds" && mode === "email_password" && (
            <form className="form" onSubmit={handleEmailPassword}>
              {isSignUp && <div className="field"><label className="lbl">Full Name</label><input className="inp" type="text" placeholder="Rajesh Kumar" value={fullName} onChange={e => setFullName(e.target.value)} required /></div>}
              <div className="field"><label className="lbl">Email</label><input className="inp" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
              <div className="field"><label className="lbl">Password</label><input className="inp" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} /></div>
              <button className="btn btn-g" type="submit" disabled={isPending}>{isPending ? <span className="spinner">⟳</span> : isSignUp ? "Create Account" : "Sign In"}</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setIsSignUp(s => !s); clear(); }}>{isSignUp ? "Already have an account? Sign in" : "New here? Create account"}</button>
            </form>
          )}
          {step === "creds" && (mode === "email_otp" || mode === "phone_otp") && (
            <form className="form" onSubmit={handleSendOtp}>
              {mode === "email_otp"
                ? <div className="field"><label className="lbl">Email</label><input className="inp" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
                : <div className="field"><label className="lbl">Mobile</label><div className="phone-row"><span className="prefix">🇮🇳 +91</span><input className="inp" type="tel" placeholder="9876543210" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} required /></div></div>
              }
              <button className="btn btn-g" type="submit" disabled={isPending}>{isPending ? <span className="spinner">⟳</span> : "Send OTP"}</button>
            </form>
          )}
          {step === "otp" && (
            <form className="form" onSubmit={handleVerifyOtp}>
              <div className="otp-wrap">
                {otp.map((d, i) => (
                  <input key={i} ref={el => { otpRefs.current[i] = el; }} className="otp-box" type="text" inputMode="numeric" maxLength={1} value={d}
                    onChange={e => { const v = e.target.value.replace(/\D/g, ""); const n = [...otp]; n[i] = v.slice(-1); setOtp(n); if (v && i < 5) otpRefs.current[i + 1]?.focus(); }}
                    onKeyDown={e => { if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus(); }} />
                ))}
              </div>
              <button className="btn btn-g" type="submit" disabled={isPending || otpValue.length !== 6}>{isPending ? <span className="spinner">⟳</span> : "Verify"}</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setStep("creds"); setOtp(["","","","","",""]); clear(); }}>← Back</button>
            </form>
          )}
          <p className="footer">By continuing you agree to <a href="#" className="link">AMC Terms</a></p>
        </main>
      </div>
    </>
  );
}
