"use client";
import { useBackendMode } from "@/lib/backend/react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";
import { Bell, Boxes, ChevronUp, ClipboardList, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Search, Settings, UserRound, UsersRound, Wrench, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { AppNavigationContext } from "@/components/page-title";
import { useStaff } from "@/components/staff/use-staff";
import { AccessPanel } from "@/components/staff/access-panel";
import { selectPreviewMember } from "@/lib/staff-client";
import { isActiveMember, staffRoles, type Permission } from "@/lib/staff";
import { SelectControl } from "@/components/select-control";
import { LogoutButton } from "./logout-button";

type NavItemConfig = { label: string; icon: LucideIcon; href?: string };
const primaryNav: NavItemConfig[] = [
  { label: "工作台", icon: LayoutDashboard, href: "/app/dashboard" },
  { label: "维修工单", icon: ClipboardList, href: "/app/repairs" },
  { label: "整机商品", icon: Boxes, href: "/app/retail" },
  { label: "客户", icon: UsersRound, href: "/app/customers" }, { label: "客户设备", icon: Wrench, href: "/app/customer-devices" },
];
function subscribeMobile(callback: () => void) {
  const media = window.matchMedia("(max-width: 767px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const mobileSnapshot = () => window.matchMedia("(max-width: 767px)").matches;
function NavItem({ item, active, onNavigate }: { item: NavItemConfig; active: boolean; onNavigate: () => void }) {
  const content = <><item.icon size={19} /><span>{item.label}</span></>;
  return item.href ? <Link className={`app-nav__item${active ? " app-nav__item--active" : ""}`} href={item.href} title={item.label} aria-label={item.label} aria-current={active ? "page" : undefined} onClick={onNavigate}>{content}</Link>
    : <span className="app-nav__item app-nav__item--disabled" aria-disabled="true" title={`${item.label} · 规划中`}><item.icon size={19} /><span>{item.label}</span></span>;
}
export function AppShell({ children }: { children: React.ReactNode }) {
  const backendMode=useBackendMode();
  const staff = useStaff();
  const [identityError,setIdentityError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, () => false);
  const sidebar = useRef<HTMLElement>(null);
  const account = useRef<HTMLDetailsElement>(null);
  const notifications = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const isActive = (href?: string) => href === "/app/dashboard" ? pathname === href : Boolean(href && pathname.startsWith(href));
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (account.current?.open && event.target instanceof Node && !account.current.contains(event.target)) account.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  useEffect(() => {
    if (!isMobile || !menuOpen || !sidebar.current) return;
    const panel = sidebar.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),summary')).filter((element) => element.getClientRects().length > 0);
    panel.querySelector<HTMLButtonElement>(".app-sidebar__close")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (account.current?.open) { event.stopPropagation(); account.current.open = false; account.current.querySelector("summary")?.focus(); return; }
        setMenuOpen(false);
      }
      if (event.key !== "Tab") return;
      const elements = focusable(); const first = elements[0]; const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    panel.addEventListener("keydown", onKeyDown);
    return () => { panel.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previousOverflow; if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [isMobile, menuOpen]);
  const routePermission = (href: string): Permission | null => href.startsWith("/app/retail") ? "retail.view" : href.startsWith("/app/repairs") || href.startsWith("/app/procurement") ? "repairs.view" : href.startsWith("/app/customer") ? "customers.view" : null;
  const allowed = Boolean(staff.ready && !staff.error && staff.member && (pathname.startsWith("/app/settings") ? staff.can("settings.edit") || staff.can("financial.read") || staff.can("staff.manage") : pathname === "/app/dashboard" ? staff.can("retail.view") && staff.can("repairs.view") && staff.can("customers.view") : !routePermission(pathname) || staff.can(routePermission(pathname)!)));
  const closeMenu = () => { setMenuOpen(false); if (account.current) account.current.open = false; };
  return <AppNavigationContext.Provider value={{ isMobile, expanded: menuOpen, toggle: () => isMobile ? setMenuOpen((value) => !value) : setCollapsed((value) => !value) }}>
    <div className={`app-shell${collapsed ? " app-shell--collapsed" : ""}`}>
      <aside id="app-sidebar" ref={sidebar} className={`app-sidebar${menuOpen ? " app-sidebar--open" : ""}`} inert={isMobile && !menuOpen} role={isMobile && menuOpen ? "dialog" : undefined} aria-modal={isMobile && menuOpen ? true : undefined} aria-label="主菜单">
        <div className="app-sidebar__brand-row"><Brand compact /><button className="app-sidebar__collapse" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "展开侧栏" : "收起侧栏"} aria-expanded={!collapsed} aria-controls="app-sidebar" title={collapsed ? "展开侧栏" : "收起侧栏"}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button><button className="app-sidebar__close" type="button" onClick={closeMenu} aria-label="关闭菜单"><X size={20} /></button></div>
        <Link className="app-search" href="/app/repairs" aria-label="搜索工单" title="搜索工单" onClick={closeMenu}><Search size={19} /><span>搜索工单</span></Link>
        <nav className="app-nav" aria-label="内部系统主导航"><small className="app-nav__label">主菜单</small>{primaryNav.filter(item => !item.href || !routePermission(item.href) || staff.can(routePermission(item.href)!)).map((item) => <NavItem item={item} active={isActive(item.href)} key={item.label} onNavigate={closeMenu} />)}</nav>
        <details ref={account} className="sidebar-account" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); if (account.current) { account.current.open = false; account.current.querySelector("summary")?.focus(); } } }}>
          <summary aria-label="账号菜单" title="账号菜单"><span className="profile-menu__avatar"><UserRound size={20} /></span><span className="sidebar-account__text"><strong>{staff.member?.name || "预览身份待核对"}</strong><small>{backendMode?"门店账号":"本地预览"} · {staff.member ? staffRoles[staff.member.role] : "访问不可用"}</small></span><ChevronUp size={16} /></summary>
          <div className="sidebar-account__actions">
            {backendMode ? <Link className="sidebar-account__action" href="/account/settings" onClick={closeMenu}><UserRound size={18} /><span>账号设置</span></Link> : null}
            {staff.can("settings.edit") || staff.can("financial.read") || staff.can("staff.manage") ? <Link className="sidebar-account__action" href="/app/settings" onClick={closeMenu}><Settings size={18} /><span>门店设置</span></Link> : null}
            {!backendMode ? <label className="field sidebar-preview-identity"><span>预览身份</span><SelectControl aria-label="预览身份" value={staff.data.currentId} onChange={event => {try {selectPreviewMember(event.target.value);setIdentityError("");closeMenu();}catch(reason){setIdentityError(reason instanceof Error ? reason.message : "切换失败");}}}>{staff.data.members.filter(isActiveMember).map(member=><option key={member.id} value={member.id}>{member.name} · {staffRoles[member.role]}</option>)}</SelectControl>{identityError ? <small role="alert">{identityError}</small> : null}</label> : null}
            <button type="button" className="sidebar-account__action" onClick={() => { if (account.current) { account.current.open = false; account.current.querySelector("summary")?.focus(); } notifications.current?.showModal(); }} aria-label="通知" title="通知"><Bell size={18} /><span>通知</span></button>
            <LogoutButton supabaseMode={backendMode} />
          </div>
        </details>
      </aside>
      {isMobile && menuOpen ? <button className="sidebar-scrim" type="button" aria-label="关闭菜单遮罩" onClick={closeMenu} tabIndex={-1} /> : null}
      <div className="app-main" inert={isMobile && menuOpen}><div className="app-content" key={staff.member?.id + ":" + staff.member?.revision}>{allowed ? children : <AccessPanel />}</div></div>
      <dialog ref={notifications} className="repair-parts-dialog" aria-label="通知"><header><h2>通知</h2><button className="icon-button" type="button" onClick={() => notifications.current?.close()} aria-label="关闭通知"><X size={20} /></button></header><div className="module-empty"><Bell size={28} /><strong>暂无通知</strong></div></dialog>
    </div>
  </AppNavigationContext.Provider>;
}
