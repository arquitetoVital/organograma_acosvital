'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';
import { signOut } from '@/app/login/actions';
import { LOGO_URL } from '@/lib/constants';
import ThemeToggle from '@/components/ui/ThemeToggle';
import styles from './Sidebar.module.css';

function IconOrg() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="1" width="8" height="6" rx="1.5"/>
      <rect x="1" y="17" width="7" height="6" rx="1.5"/>
      <rect x="16" y="17" width="7" height="6" rx="1.5"/>
      <path d="M12 7v4.5M12 11.5H4.5v4M12 11.5H19.5v4"/>
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"/>
      <path d="M2 22h20"/>
      <path d="M10 7h4M10 11h4M10 15h4"/>
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function IconLab() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2h6M10 2v6.5L5 18a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9.5V2"/>
      <path d="M7 14h10"/>
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

const NAV = [
  { href: '/',         label: 'Organograma', sub: 'Estrutura da empresa', Icon: IconOrg      },
  { href: '/unidades', label: 'Unidades',    sub: 'Mapa de unidades',     Icon: IconBuilding },
  { href: '/clientes', label: 'Clientes',    sub: 'Mapa de clientes',     Icon: IconUsers    },
  { href: '/globe-lab', label: 'Globe Lab',  sub: 'Globo 3D (experimental)', Icon: IconLab   },
] as const;

export default function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname  = usePathname();
  const [isFs,    setIsFs]    = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFs = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch {}
  }, []);

  async function handleSignOut() {
    setPending(true);
    await signOut();
  }

  return (
    <aside className={styles.sidebar}>

      {/* ── Logo ── */}
      <div className={styles.brand}>
        <img src={LOGO_URL} alt="Açosvital" className={styles.logo} />
      </div>

      {/* ── Navegação ── */}
      <nav className={styles.nav}>
        <span className={styles.navSection}>Navegação</span>
        <ul className={styles.navList}>
          {NAV.map(({ href, label, sub, Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link href={href} className={`${styles.navItem} ${active ? styles.active : ''}`}>
                  <span className={styles.navIcon}><Icon /></span>
                  <span className={styles.navText}>
                    <span className={styles.navLabel}>{label}</span>
                    <span className={styles.navSub}>{sub}</span>
                  </span>
                  {active && <span className={styles.activePip} />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={styles.spacer} />

      {/* ── Admin ── */}
      {isAdmin && (
        <div className={styles.adminSection}>
          <Link href="/admin" className={`${styles.navItem} ${pathname.startsWith('/admin') ? styles.active : ''}`}>
            <span className={styles.navIcon}><IconSettings /></span>
            <span className={styles.navText}>
              <span className={styles.navLabel}>Administrar</span>
              <span className={styles.navSub}>Administração</span>
            </span>
            {pathname.startsWith('/admin') && <span className={styles.activePip} />}
          </Link>

          {pathname.startsWith('/admin') && (
            <ul className={styles.subNav}>
              {[
                { href: '/admin/organograma', label: 'Organograma' },
                { href: '/admin/clientes',    label: 'Clientes'    },
                { href: '/admin/unidades',    label: 'Unidades'    },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className={`${styles.subNavItem} ${pathname === href ? styles.subNavActive : ''}`}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Rodapé ── */}
      <div className={styles.footer}>
        <ThemeToggle className={styles.footerBtn} />

        <button onClick={toggleFs} className={styles.footerBtn}>
          {isFs ? (
            <svg width="13" height="13" viewBox="0 0 15 15" fill="none">
              <path d="M5 1H2v3M10 1h3v3M13 10v3h-3M5 14H2v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 15 15" fill="none">
              <path d="M1 5V1h4M10 1h4v4M14 10v4h-4M5 14H1v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {isFs ? 'Sair da tela cheia' : 'Tela cheia'}
        </button>

        <button onClick={handleSignOut} disabled={pending} className={styles.footerBtn}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          {pending ? 'Saindo…' : 'Sair da conta'}
        </button>
      </div>

    </aside>
  );
}
