
export type ProposalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

export type ItemStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Unit {
  id: number;
  nome_unidade: string;
  empresaid: string; // Foreign Key to Client
  nome_fantasia?: string;
  razao_social?: string;
  city?: string;
  state?: string;
}

export interface DocSeg {
  id?: number;
  created_at?: string;
  mes: number;
  empresa: number; // Unit ID
  doc: number; // Procedure ID
  valor?: number;
  status: string;
  data_recebimento: string; // ISO Date
  prazo: string; // ISO Date
  data_entrega: string; // ISO Date
  enviado: boolean;
  obs?: string;
}

export interface Client {
  id: string; // UUID
  nome: string; // Display name (fallback or derived)
  nome_fantasia: string; // Now required/primary
  razao_social: string; // Now required/primary
  avatar?: string;
  cliente_propostas?: number[];
  clientefrequente?: boolean;
  modalidade?: string;
  units?: Unit[]; // Hydrated list of units
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
  preco: number;
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
  status?: ItemStatus;
  preco?: number;
  data_para_entrega?: string;
  data_entregue?: string;
}

export interface Proposta {
  id: number;
  itensproposta: number[];
  idcliente: string;
  unidade_id?: number; // Linked Unit
  created_at: string;
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
  unidade?: Unit; // Enriched unit data
  itens: EnrichedItem[];
  totalValue: number;
}