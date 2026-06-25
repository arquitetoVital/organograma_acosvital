'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import styles from './SidebarShell.module.css';

interface Props {
  isAdmin: boolean;
  userEmail?: string;
  children: React.ReactNode;
}

const HIDDEN_PATHS = ['/login'];

export default function SidebarShell({ isAdmin, userEmail, children }: Props) {
  const pathname = usePathname();
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const showSidebar = !HIDDEN_PATHS.some(p => pathname.startsWith(p));

  if (!showSidebar) return <>{children}</>;

  return (
    <div className={styles.shell}>
      <Sidebar isAdmin={isAdmin} userEmail={userEmail} floating={isFs} />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
