
export type ProposalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

export type ItemStatus = 'NÃO INICIADO' | 'EM PROCESSO' | 'EM REVISÃO' | 'ENVIADO AO CLIENTE' | 'VALIDADO PELO CLIENTE' | 'PRONTO PARA COBRANÇA';

export interface Client {
  id: string; // UUID
  nome: string; // Display name (mapped from nome_fantasia or razao_social)
  nome_fantasia?: string;
  razao_social?: string;
  avatar?: string; // Optional, might not exist in DB
  cliente_propostas?: number[]; // Array of proposal IDs
  clientefrequente?: boolean;
}

export interface Modulo {
  id: number;
  nome: string;
}

export interface Categoria {
  id: number;
  nome: string;
  idmodulo: number;
}

export interface Procedimento {
  id: number;
  nome: string;
  preco: number; // Fallback price
  preco_avulso?: number | null;
  preco_particular?: number | null;
  preco_parceiro?: number | null;
  preco_clientegama?: number | null;
  preco_premium?: number | null;
  idcategoria: number;
}

export interface ItemProposta {
  id: number;
  idprocedimento: number;
  quantidade: number;
  status?: ItemStatus; // Not a DB column, will be inferred.
  preco?: number; // Price at the time of creation - RENAMED from preco_unitario
  data_para_entrega?: string; // ISO Date string for the deadline
  data_entregue?: string; // ISO Date string for when it was completed
}

export interface Proposta {
  id: number;
  itensproposta: number[]; // Array of ItemProposta IDs
  idcliente: string; // UUID
  created_at: string; // ISO Date string
  status: ProposalStatus;
}

// Hydrated types for UI consumption (Joined data)
export interface EnrichedItem extends Omit<ItemProposta, 'status'> {
  uiKey: string; // Unique key for React rendering (handles duplicate items in array)
  procedimento: Procedimento;
  categoria: Categoria;
  modulo: Modulo;
  total: number;
  modalidade: string; // Inferred from price, not stored in DB
  status: ItemStatus; // Re-added as required, will be inferred for the UI.
}

export interface EnrichedProposal extends Proposta {
  cliente: Client;
  itens: EnrichedItem[];
  totalValue: number;
}