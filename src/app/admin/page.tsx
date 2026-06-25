import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './hub.module.css';

export const metadata: Metadata = {
  title: 'Painel — Açosvital',
};

const CARDS = [
  {
    href:       '/admin/funcionarios',
    icon:       '👥',
    title:      'Funcionários',
    desc:       'Cadastrar funcionários — gera automaticamente o nó no organograma',
    colorStyle: styles.cardBlue,
  },
  {
    href:       '/admin/cargos',
    icon:       '🏷',
    title:      'Cargos',
    desc:       'Gerenciar cargos e seus níveis hierárquicos',
    colorStyle: styles.cardPurple,
  },
  {
    href:       '/admin/setores',
    icon:       '🏗',
    title:      'Setores',
    desc:       'Criar e organizar setores e sub-setores da empresa',
    colorStyle: styles.cardOrange,
  },
  {
    href:       '/admin/unidades/cadastro',
    icon:       '🏢',
    title:      'Unidades',
    desc:       'Cadastrar matrizes e filiais da empresa',
    colorStyle: styles.cardGreen,
  },
  {
    href:       '/admin/clientes',
    icon:       '🌍',
    title:      'Clientes',
    desc:       'Adicionar e gerenciar clientes no mapa global',
    colorStyle: styles.cardRed,
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
