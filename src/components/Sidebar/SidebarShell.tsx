'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import styles from './SidebarShell.module.css';

interface Props {
  isAdmin: boolean;
  children: React.ReactNode;
}

const HIDDEN_PATHS = ['/login'];

export default function SidebarShell({ isAdmin, children }: Props) {
  const pathname = usePathname();
  const showSidebar = !HIDDEN_PATHS.some(p => pathname.startsWith(p));

  if (!showSidebar) return <>{children}</>;

  return (
    <div className={styles.shell}>
      <Sidebar isAdmin={isAdmin} />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
