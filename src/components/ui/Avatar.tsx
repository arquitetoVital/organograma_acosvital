'use client';

import { useState, useEffect } from 'react';
import { getInitials } from '@/lib/nodeUtils';

interface AvatarProps {
  /** URL da foto. Se vazio ou com erro de carregamento, exibe iniciais. */
  photoUrl:  string;
  /** Nome completo usado para calcular as iniciais. */
  name:      string;
  /** Tamanho em pixels (largura e altura). Padrão: 48. */
  size?:     number;
  /** Cor de fundo do fallback de iniciais. */
  color?:    string;
}

/**
 * Avatar circular que exibe foto quando disponível,
 * ou um fallback com as iniciais do nome sobre fundo colorido.
 */
export default function Avatar({ photoUrl, name, size = 48, color = '#6366f1' }: AvatarProps) {
  const [hasError, setHasError] = useState(false);

  // Reseta o erro sempre que a URL mudar (novo upload)
  useEffect(() => setHasError(false), [photoUrl]);

  const baseStyle: React.CSSProperties = {
    width:        size,
    height:       size,
    borderRadius: '50%',
    flexShrink:   0,
    objectFit:    'cover',
  };

  if (!photoUrl || hasError) {
    return (
      <div
        style={{
          ...baseStyle,
          background:     color,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontSize:       size * 0.34,
          fontWeight:     700,
          color:          '#fff',
          userSelect:     'none',
        }}
      >
        {getInitials(name) || '?'}
      </div>
    );
  }

  return (
    <img
      src={photoUrl}
      alt={name}
      style={baseStyle}
      onError={() => setHasError(true)}
    />
  );
}
