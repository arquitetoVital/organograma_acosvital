import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './hub.module.css';

export const metadata: Metadata = {
  title: 'Painel — Açosvital',
};

const CARDS = [
  {
    href:       '/admin/organograma',
    icon:       '👥',
    title:      'Organograma',
    desc:       'Cadastrar e editar pessoas, setores e hierarquias da empresa',
    colorStyle: styles.cardBlue,
  },
  {
    href:       '/admin/clientes',
    icon:       '🌍',
    title:      'Clientes',
    desc:       'Adicionar e gerenciar clientes no mapa global',
    colorStyle: styles.cardRed,
  },
  {
    href:       '/admin/unidades',
    icon:       '🏢',
    title:      'Unidades',
    desc:       'Cadastrar e gerenciar as filiais e unidades no mapa',
    colorStyle: styles.cardGreen,
  },
] as const;

export default function AdminHubPage() {
  return (
    <div className={styles.page}>
      <div className={styles.contentWrap}>
        <p className={styles.prompt}>O que você deseja gerenciar?</p>
        <div className={styles.grid}>
          {CARDS.map(card => (
            <Link
              key={card.href}
              href={card.href}
              className={`${styles.card} ${card.colorStyle}`}
            >
              <div className={styles.cardIcon}>{card.icon}</div>
              <p className={styles.cardTitle}>{card.title}</p>
              <p className={styles.cardDesc}>{card.desc}</p>
              <span className={styles.cardArrow}>→</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
