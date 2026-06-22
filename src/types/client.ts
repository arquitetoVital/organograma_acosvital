/** Formato do JSON exportado pelo Omie */
export interface OmieClient {
  codigo_omie: number;
  nome: string;
  endereco: string;
  latitude: number;
  longitude: number;
}

/** Ponto enriquecido usado internamente no mapa de clientes */
export interface ClientPoint {
  /** codigo_omie usado como ID único */
  id: number;
  codigo_omie: number;
  nome: string;
  endereco: string;
  lat: number;
  lon: number;
  /** 'file' = veio do clients.json | 'manual' = adicionado pelo painel */
  source: 'file' | 'manual';
}

/** Converte um OmieClient para ClientPoint */
export function fromOmie(c: OmieClient): ClientPoint {
  return {
    id: c.codigo_omie,
    codigo_omie: c.codigo_omie,
    nome: c.nome,
    endereco: c.endereco,
    lat: c.latitude,
    lon: c.longitude,
    source: 'file',
  };
}

/** Converte ClientPoint para o shape mínimo que o GlobeCanvas aceita */
export function toGlobePoint(c: ClientPoint) {
  return { id: c.id, lat: c.lat, lon: c.lon, label: c.nome };
}
