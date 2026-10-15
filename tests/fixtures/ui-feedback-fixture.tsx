"use client";
import { useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { Toast } from "@/components/toast";
import { ContentProgress } from "@/components/operation-feedback";
import { NavigationLink } from "@/components/navigation-link";

export function FeedbackFixture() {
  const [notice, setNotice] = useState(0), [shown, setShown] = useState(true), [hidden, setHidden] = useState(false);
  const [globalOnly, setGlobalOnly] = useState("");
  const [hasGlobal, setHasGlobal] = useState(true);
  const [busy, setBusy] = useState(false), [oauth, setOAuth] = useState(false);
  const message = "DEMO saved";
  return <main style={{ maxWidth: 720, margin: "auto", padding: 16 }}><ContentProgress /><h1>DEMO feedback fixture</h1>
    <button id="notify" type="button" onClick={() => { setGlobalOnly(""); setNotice(value => value + 1); setHidden(false); }}>New acknowledgement</button>
    <button id="hidden-notify" type="button" onClick={() => { setHidden(true); setNotice(value => value + 1); }}>Acknowledge hidden tab</button>
    <button id="global-only" type="button" onClick={() => setGlobalOnly(crypto.randomUUID())}>New global event</button>
    <button id="toggle-global" type="button" onClick={() => setHasGlobal(value => !value)}>Toggle global fallback</button>
    <button id="remount" type="button" onClick={() => setShown(value => !value)}>Mount local owner</button>
    <button id="hide" type="button" onClick={() => setHidden(value => !value)}>Toggle hidden tab</button>
    {hasGlobal && notice ? <Toast priority="global" noticeId={globalOnly || `fixture:${notice}`} message={globalOnly ? "DEMO newer global saved" : message} /> : null}
    {shown ? <section hidden={hidden} id="local-owner">{notice ? <Toast noticeId={`fixture:${notice}`} message={message} /> : null}</section> : null}
    <button id="busy" type="button" onClick={() => setBusy(value => !value)}>Toggle real busy</button>
    <button id="icon-button" className="button button--primary" type="button" aria-busy={busy}><Save size={18} />Save</button>
    <button id="text-button" className="button button--secondary" type="button" aria-busy={busy}>Refresh</button>
    <button id="oauth" type="button" onClick={() => setOAuth(value => !value)}>Toggle OAuth</button>
    <form aria-busy={oauth}><button id="social" className="button" type="button">{oauth ? <LoaderCircle size={16} className="spin" /> : null}Google</button><button id="mail" className="button" type="submit" aria-busy={false}><Save size={18} />Email</button></form>
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
      <NavigationLink id="nav-text" href="/destination">Text destination</NavigationLink>
      <NavigationLink id="nav-icon" href="/destination" className="button button--primary" icon={<Save size={18} />}>Icon destination</NavigationLink>
      <NavigationLink id="nav-grid" href="/destination" style={{ display: "grid", gridTemplateColumns: "1fr auto", minHeight: 44 }} icon={<Save size={18} />} iconPosition="end"><span>DEMO grid row</span></NavigationLink>
    </div><p id="retained-content">DEMO retained content</p>
  </main>;
}
