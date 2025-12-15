import { createClient } from '@supabase/supabase-js';
import {
  Proposta, ItemProposta, Procedimento, Categoria, Modulo, Client,
  EnrichedProposal, EnrichedItem, ProposalStatus, ItemStatus
} from '../types';

// --- Supabase Configuration ---
const SUPABASE_URL = 'https://wofipjazcxwxzzxjsflh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvZmlwamF6Y3h3eHp6eGpzZmxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MDA2NjcsImV4cCI6MjA3NDM3NjY2N30.gKjTEhXbrvRxKcn3cNvgMlbigXypbshDWyVaLqDjcpQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Interfaces for Context ---
export interface CatalogContext {
  modulos: Modulo[];
  categorias: Categoria[];
  procedimentos: Procedimento[];
  clientes: Client[];
}

type PriceTierKey = 'preco_avulso' | 'preco_particular' | 'preco_parceiro' | 'preco_clientegama' | 'preco_premium';

const priceTiers: Record<PriceTierKey, string> = {
  preco_avulso: 'Avulso',
  preco_particular: 'Particular',
  preco_parceiro: 'Parceiro',
  preco_clientegama: 'Cliente Gama',
  preco_premium: 'Premium',
};

// --- Service Methods ---

// Helper to handle table name variations (singular vs plural, etc.)
const safeFetch = async <T>(primaryTable: string, fallbackTable?: string) => {
  let { data, error } = await supabase.from(primaryTable).select('*');

  if (error && fallbackTable) {
    console.warn(`Failed to fetch from '${primaryTable}', trying '${fallbackTable}'...`);
    const fallback = await supabase.from(fallbackTable).select('*');
    data = fallback.data;
    error = fallback.error;
  }

  // Ensure we always return an array, never null
  return { data: (data || []) as T[], error };
};

export const fetchCatalogData = async (): Promise<CatalogContext> => {
  try {
    const modRes = await safeFetch<Modulo>('modulos', 'modulo');
    const catRes = await safeFetch<Categoria>('categoria');
    const procRes = await safeFetch<Procedimento>('procedimento', 'procedimentos');
    const cliRes = await safeFetch<any>('clientes'); // Fetch as any to handle raw data

    if (cliRes.error) console.error("Erro ao buscar clientes:", cliRes.error.message);
    if (modRes.error) console.error("Erro ao buscar módulos:", modRes.error.message);

    // --- FILTERING LOGIC START ---
    let finalModulos = modRes.data || [];
    let finalCategorias = catRes.data || [];
    let finalProcedimentos = procRes.data || [];

    // Identify modules to hide (Módulo 14 and Contas)
    const modulesToHide = finalModulos.filter(m =>
      m.nome && (
        m.nome.includes('Módulo 14') ||
        m.nome.includes('Modulo 14') ||
        m.nome.includes('Contas')
      )
    );
    const hiddenModuleIds = modulesToHide.map(m => m.id);

    // Apply cascading filter
    if (hiddenModuleIds.length > 0) {
      console.log(`Filtering out ${hiddenModuleIds.length} modules (Módulo 14)`);

      finalModulos = finalModulos.filter(m => !hiddenModuleIds.includes(m.id));

      const hiddenCategoryIds = finalCategorias
        .filter(c => hiddenModuleIds.includes(c.idmodulo))
        .map(c => c.id);

      finalCategorias = finalCategorias.filter(c => !hiddenModuleIds.includes(c.idmodulo));

      finalProcedimentos = finalProcedimentos.filter(p => !hiddenCategoryIds.includes(p.idcategoria));
    }
    // --- FILTERING LOGIC END ---

    // Map raw client data to Client interface with proper 'nome'
    const mappedClients: Client[] = (cliRes.data || []).map((rawClient: any) => {
      const displayName = rawClient.nome_fantasia || rawClient.razao_social || rawClient.nome || `ID: ${String(rawClient.id).substring(0, 8)}`;
      return {
        id: rawClient.id,
        nome: displayName,
        nome_fantasia: rawClient.nome_fantasia,
        razao_social: rawClient.razao_social,
        avatar: rawClient.avatar,
        cliente_propostas: rawClient.cliente_propostas || [],
        clientefrequente: rawClient.clientefrequente
      };
    });

    return {
      modulos: finalModulos,
      categorias: finalCategorias,
      procedimentos: finalProcedimentos,
      clientes: mappedClients,
    };
  } catch (e) {
    console.error("Critical error fetching catalog:", e);
    return { modulos: [], categorias: [], procedimentos: [], clientes: [] };
  }
};

export const getProposals = async (): Promise<EnrichedProposal[]> => {
  try {
    const { data: proposalsData, error: propError } = await supabase
      .from('proposta')
      .select('*')
      .order('created_at', { ascending: false });

    if (propError) throw propError;

    const proposals = (proposalsData || []).map((p: any) => ({
      ...p,
      status: p.status || 'PENDING',
    })) as Proposta[];


    // Collect all referenced item IDs to fetch them in one go
    // Filter out null/undefined IDs aggressively
    const allItemIds = proposals.reduce<number[]>((acc, p) => {
      const items = p.itensproposta || (p as any).itens_proposta;
      if (Array.isArray(items)) {
        const validIds = items.filter((id: any) => id !== null && id !== undefined && id !== '');
        return [...acc, ...validIds];
      }
      return acc;
    }, []);

    // Fetch Items Definition from DB
    let items: ItemProposta[] = [];
    if (allItemIds.length > 0) {
      const { data, error } = await supabase.from('itensproposta').select('*').in('id', allItemIds);

      if (error) console.error("Error fetching items:", error);
      items = (data || []) as ItemProposta[];
    } else {
      // Only fetch all if we really have no clues, but be safe
      const { data } = await safeFetch<ItemProposta>('itensproposta');
      items = data;
    }

    const context = await fetchCatalogData();

    return proposals.map(p => enrichProposal(p, items, context));

  } catch (error) {
    console.error("Error fetching proposals:", error);
    return [];
  }
};

export const getProposalById = async (id: number): Promise<EnrichedProposal | undefined> => {
  try {
    const { data: proposalData, error } = await supabase
      .from('proposta')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !proposalData) return undefined;

    const p = {
      ...proposalData,
      status: proposalData.status || 'PENDING'
    } as Proposta;

    // Handle aliases and ensure array
    const rawItems = p.itensproposta || (p as any).itens_proposta;
    const itemIds = Array.isArray(rawItems) ? rawItems.filter((x: any) => x != null) : [];

    let relatedItems: ItemProposta[] = [];

    if (itemIds.length > 0) {
      const { data, error: itemsError } = await supabase.from('itensproposta').select('*').in('id', itemIds);
      if (itemsError) console.error(`Error fetching items for proposal ${id}:`, itemsError);
      relatedItems = (data || []) as ItemProposta[];
    } else {
      console.warn(`Proposal ${id} has empty items array. Trying FK lookup.`);
      // Fallback for older data structures where items might be linked via a (now-removed) foreign key.
      const { data } = await supabase.from('itensproposta').select('*').eq('proposta_id', id);
      if (data && data.length > 0) {
        relatedItems = data as unknown as ItemProposta[];
      }
    }

    const context = await fetchCatalogData();

    return enrichProposal(p, relatedItems, context);
  } catch (error) {
    console.error(`Error fetching proposal ${id}:`, error);
    return undefined;
  }
};

export const updateProposalStatus = async (id: number, status: ProposalStatus): Promise<void> => {
  const { error } = await supabase
    .from('proposta')
    .update({ status })
    .eq('id', id);

  if (error) console.error("Error updating status:", error);
};

export const deleteProposal = async (proposalId: number): Promise<{ success: boolean; error?: string }> => {
  try {
    // Step 1: Get all possible item IDs related to this proposal.
    // Method A: From the array field in the proposal table.
    const { data: proposalData, error: fetchError } = await supabase
      .from('proposta')
      .select('itensproposta')
      .eq('id', proposalId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        // Proposal not found, consider it already deleted.
        return { success: true };
      }
      console.error(`Error fetching proposal ${proposalId} for deletion:`, fetchError.message);
      return { success: false, error: `Erro ao buscar proposta: ${fetchError.message}` };
    }

    const itemIdsFromField = proposalData?.itensproposta || (proposalData as any)?.itens_proposta || [];
    const validItemIdsFromField = Array.isArray(itemIdsFromField) ? itemIdsFromField.filter(id => id != null) : [];

    // Method B: From a potential foreign key on the items table.
    const { data: itemsFromFk, error: fkError } = await supabase
      .from('itensproposta')
      .select('id')
      .eq('proposta_id', proposalId);

    if (fkError) {
      console.warn(`Could not query items by 'proposta_id' for proposal ${proposalId}: ${fkError.message}. This may be expected.`);
    }
    const itemIdsFromFk = itemsFromFk ? itemsFromFk.map(item => item.id) : [];

    // Combine and deduplicate all found item IDs.
    const allItemIdsToDelete = [...new Set([...validItemIdsFromField, ...itemIdsFromFk])];

    // Step 2: Delete all associated items.
    if (allItemIdsToDelete.length > 0) {
      console.log(`Attempting to delete ${allItemIdsToDelete.length} items for proposal ${proposalId}:`, allItemIdsToDelete);
      const { error: deleteItemsError } = await supabase
        .from('itensproposta')
        .delete()
        .in('id', allItemIdsToDelete);

      if (deleteItemsError) {
        console.error(`CRITICAL: Failed to delete items for proposal ${proposalId}. Aborting. Error:`, deleteItemsError.message);
        if (deleteItemsError.code === '23503') {
          return { success: false, error: 'Não é possível apagar os itens desta proposta pois eles estão vinculados a outros registros (ex: Financeiro).' };
        }
        return { success: false, error: `Erro ao apagar itens: ${deleteItemsError.message}` };
      }
    }

    // Step 3: Delete the proposal itself.
    if (proposalData) {
      const { error: deleteProposalError } = await supabase
        .from('proposta')
        .delete()
        .eq('id', proposalId);

      if (deleteProposalError) {
        console.error(`CRITICAL: Failed to delete proposal ${proposalId} itself. Error:`, deleteProposalError.message);
        if (deleteProposalError.code === '23503') {
          return { success: false, error: 'Não é possível apagar esta proposta pois ela está vinculada a outros registros (ex: Financeiro).' };
        }
        return { success: false, error: `Erro ao apagar proposta: ${deleteProposalError.message}` };
      }
    } else {
      console.log(`Proposal ${proposalId} was not found, assuming already deleted. Cleanup complete.`);
    }

    return { success: true };

  } catch (e: any) {
    console.error(`Exception while deleting proposal ${proposalId}:`, e.message);
    return { success: false, error: `Erro interno: ${e.message}` };
  }
};


export const updateItemStatus = async (itemId: number, status: ItemStatus): Promise<void> => {
  const updatePayload: { data_entregue?: string | null } = {};

  // Persist status by updating the 'data_entregue' timestamp, since 'status' column doesn't exist.
  if (status === 'VALIDADO PELO CLIENTE' || status === 'PRONTO PARA COBRANÇA') {
    updatePayload.data_entregue = new Date().toISOString();
  } else if (status === 'NÃO INICIADO') {
    // Allow "un-delivering" an item
    updatePayload.data_entregue = null;
  } else {
    // For intermediate statuses ('EM PROCESSO', etc.), there is no DB column to update.
    // The change is client-side only and will be lost on refresh.
    return;
  }

  const { error } = await supabase
    .from('itensproposta')
    .update(updatePayload)
    .eq('id', itemId);

  if (error) {
    console.error("Error updating item status:", error);
  }
};

export const updateItemDetails = async (
  itemId: number,
  details: {
    preco?: number;
    data_para_entrega?: string;
  }
): Promise<void> => {
  const { error } = await supabase
    .from('itensproposta')
    .update(details)
    .eq('id', itemId);

  if (error) {
    console.error("Error updating item details:", error);
  }
};

export const deleteItem = async (proposalId: number, itemId: number): Promise<boolean> => {
  try {
    // 1. Delete the item from the itensproposta table
    const { error: deleteError } = await supabase
      .from('itensproposta')
      .delete()
      .eq('id', itemId);

    if (deleteError) {
      console.error(`Error deleting item ${itemId}:`, deleteError);
      return false;
    }

    // 2. Update the proposal's itensproposta array
    const { data: proposalData, error: fetchError } = await supabase
      .from('proposta')
      .select('itensproposta')
      .eq('id', proposalId)
      .single();

    if (fetchError || !proposalData) {
      console.error(`Error fetching proposal ${proposalId} to update items:`, fetchError);
      return false;
    }

    const currentItems = proposalData.itensproposta || [];
    const newItems = currentItems.filter((id: number) => id !== itemId);

    const { error: updateError } = await supabase
      .from('proposta')
      .update({ itensproposta: newItems })
      .eq('id', proposalId);

    if (updateError) {
      console.error(`Error updating proposal ${proposalId} items list:`, updateError);
      return false;
    }

    return true;
  } catch (e) {
    console.error(`Exception deleting item ${itemId}:`, e);
    return false;
  }
};

export const addItemToProposal = async (
  proposalId: number,
  itemData: {
    procedimentoId: number;
    quantidade: number;
    preco: number;
    data_para_entrega: string;
  }
): Promise<boolean> => {
  try {
    // 1. Create the new item in itensproposta
    const { data: newItemData, error: insertError } = await supabase
      .from('itensproposta')
      .insert({
        idprocedimento: itemData.procedimentoId,
        quantidade: itemData.quantidade,
        preco: itemData.preco,
        data_para_entrega: itemData.data_para_entrega,
      })
      .select('id')
      .single();

    if (insertError || !newItemData) {
      console.error('Error creating new item:', insertError);
      return false;
    }

    const newItemId = newItemData.id;

    // 2. Fetch current proposal items
    const { data: proposalData, error: fetchError } = await supabase
      .from('proposta')
      .select('itensproposta')
      .eq('id', proposalId)
      .single();

    if (fetchError || !proposalData) {
      console.error(`Error fetching proposal ${proposalId} to add item:`, fetchError);
      return false;
    }

    const currentItems = proposalData.itensproposta || [];
    const newItemsList = [...currentItems, newItemId];

    // 3. Update proposal with new item list
    const { error: updateError } = await supabase
      .from('proposta')
      .update({ itensproposta: newItemsList })
      .eq('id', proposalId);

    if (updateError) {
      console.error(`Error updating proposal ${proposalId} with new item:`, updateError);
      return false;
    }

    return true;
  } catch (e) {
    console.error('Exception adding item to proposal:', e);
    return false;
  }
};


export const updateProcedurePrice = async (
  procedureId: number,
  pricesToUpdate: Partial<Procedimento>
): Promise<boolean> => {
  let { error } = await supabase
    .from('procedimento')
    .update(pricesToUpdate)
    .eq('id', procedureId);

  if (error) {
    console.error(`Error updating prices for procedure ${procedureId} on 'procedimento':`, error);
    const { error: fallbackError } = await supabase
      .from('procedimentos')
      .update(pricesToUpdate)
      .eq('id', procedureId);
    if (fallbackError) {
      console.error(`Fallback error updating prices for procedure ${procedureId} on 'procedimentos':`, fallbackError);
      return false;
    }
  }

  return !error;
};

export const createProposal = async (
  clientId: string,
  items: {
    procedimentoId: number;
    quantidade: number;
    preco: number;
    data_para_entrega: string;
  }[]
): Promise<boolean> => {
  try {
    // 1. Create Proposal record first (without items)
    const { data: propData, error: propError } = await supabase
      .from('proposta')
      .insert({
        idcliente: clientId,
        created_at: new Date().toISOString(),
        status: 'PENDING',
      })
      .select()
      .single();

    if (propError || !propData) {
      console.error('Error creating proposal:', propError);
      return false;
    }

    const proposalId = propData.id;

    // 2. Create the unlinked items
    // REMOVED `proposta_id` and `status` as they don't exist in the 'itensproposta' table schema
    const itemsPayload = items.map((i) => ({
      idprocedimento: i.procedimentoId,
      quantidade: i.quantidade,
      preco: i.preco,
      data_para_entrega: i.data_para_entrega,
    }));

    const { data: itemsData, error: itemsError } = await supabase
      .from('itensproposta')
      .insert(itemsPayload)
      .select('id');

    if (itemsError) {
      console.error('Error creating items:', itemsError);
      // TODO: Consider rolling back the proposal creation here.
      return false;
    }

    // 3. Update the proposal with the array of newly created item IDs
    if (itemsData && itemsData.length > 0) {
      const ids = itemsData.map((x) => x.id);
      await supabase
        .from('proposta')
        .update({ itensproposta: ids })
        .eq('id', proposalId);
    }

    return true;
  } catch (e) {
    console.error('Exception creating proposal:', e);
    return false;
  }
};

// --- Helper to Join Tables ---

const unrollEnrichedItems = (items: EnrichedItem[]): EnrichedItem[] => {
  const unrolled: EnrichedItem[] = [];
  items.forEach(item => {
    if (item.quantidade > 1) {
      for (let i = 0; i < item.quantidade; i++) {
        unrolled.push({
          ...item,
          quantidade: 1,
          total: item.preco ?? item.procedimento?.preco_avulso ?? item.procedimento?.preco ?? 0,
          uiKey: `${item.id}-${i}`
        });
      }
    } else {
      unrolled.push(item);
    }
  });
  return unrolled;
};


const enrichProposal = (
  proposal: Proposta,
  allItems: ItemProposta[],
  context: CatalogContext
): EnrichedProposal => {

  // 1. Resolve Client
  const dbClient = context.clientes.find(c => String(c.id) === String(proposal.idcliente));
  const rawClient = dbClient as any;
  const nameFromDB = rawClient?.nome_fantasia || rawClient?.razao_social || rawClient?.nome;
  const displayName = nameFromDB || `Cliente Desconhecido (ID: ${String(proposal.idcliente)?.substring(0, 8)}...)`;

  const client: Client = dbClient ? {
    id: rawClient.id,
    nome: displayName,
    nome_fantasia: rawClient.nome_fantasia,
    razao_social: rawClient.razao_social,
    avatar: rawClient.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`
  } : {
    id: proposal.idcliente || 'unknown',
    nome: displayName,
    avatar: 'https://ui-avatars.com/api/?name=Unknown'
  };

  // 2. Resolve Items
  const rawItemIds = proposal.itensproposta || (proposal as any).itens_proposta;
  const itemIdsArray = Array.isArray(rawItemIds) ? rawItemIds.filter((x: any) => x != null) : [];

  let enrichedItems: EnrichedItem[] = [];

  const enrichItem = (itemDef: ItemProposta, index: number): EnrichedItem | null => {
    if (!itemDef) return null;

    const procedimento = context.procedimentos.find(p => p.id === itemDef.idprocedimento);
    if (!procedimento) return null;

    const categoria = context.categorias.find(c => c.id === procedimento.idcategoria);
    if (!categoria) return null;

    const modulo = context.modulos.find(m => m.id === categoria.idmodulo);
    if (!modulo) return null;

    // Infer status from 'data_entregue' as 'status' column doesn't exist
    const status: ItemStatus = itemDef.data_entregue ? 'PRONTO PARA COBRANÇA' : 'NÃO INICIADO';

    const unitPrice = itemDef.preco;
    let inferredModalidade = 'Manual';

    const priceTierMatch = (Object.keys(priceTiers) as PriceTierKey[]).find(tier => procedimento[tier] === unitPrice);
    if (priceTierMatch) {
      inferredModalidade = priceTiers[priceTierMatch];
    } else if (unitPrice === undefined || unitPrice === null) {
      inferredModalidade = 'Avulso';
    }

    const total = (unitPrice != null)
      ? unitPrice * itemDef.quantidade
      : (procedimento.preco_avulso ?? procedimento.preco ?? 0) * itemDef.quantidade;

    const finalItem: EnrichedItem = {
      ...itemDef,
      uiKey: `${itemDef.id}-${index}`,
      procedimento,
      categoria,
      modulo,
      total,
      modalidade: inferredModalidade,
      status, // Overwrite with inferred status
    };

    if (!finalItem.data_para_entrega) {
      const proposalCreationDate = new Date(proposal.created_at);
      proposalCreationDate.setDate(proposalCreationDate.getDate() + 7);
      finalItem.data_para_entrega = proposalCreationDate.toISOString();
    }

    return finalItem;
  };

  if (itemIdsArray.length > 0) {
    enrichedItems = itemIdsArray
      .map((id, index) => {
        const itemDef = allItems.find(i => String(i.id) === String(id));
        return enrichItem(itemDef!, index);
      })
      .filter((i): i is EnrichedItem => i !== null);
  } else {
    // Fallback for proposals that might not have the item ID array populated
    enrichedItems = allItems
      .filter(item => (item as any).proposta_id === proposal.id)
      .map(enrichItem)
      .filter((i): i is EnrichedItem => i !== null);
  }

  const totalValue = enrichedItems.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const finalDisplayItems = unrollEnrichedItems(enrichedItems);

  return {
    ...proposal,
    cliente: client,
    itens: finalDisplayItems,
    totalValue
  };
};

export const createProcedure = async (name: string, categoryId: number): Promise<{ success: boolean; data?: Procedimento; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('procedimento')
      .insert([
        {
          nome: name,
          idcategoria: categoryId,
          preco_avulso: 1,
          preco_particular: 0,
          preco_parceiro: 0,
          preco_clientegama: 0,
          preco_premium: 0,

        }
      ])
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: data as Procedimento };
  } catch (e: any) {
    console.error("Error creating procedure:", e.message);
    return { success: false, error: e.message };
  }
};

export const updateProcedureName = async (id: number, newName: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('procedimento')
      .update({ nome: newName })
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (e: any) {
    console.error("Error updating procedure name:", e.message);
    return { success: false, error: e.message };
  }
};

export const deleteProcedure = async (id: number): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('procedimento')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (e: any) {
    console.error("Error deleting procedure:", e.message);
    return { success: false, error: e.message };
  }
};

export const updateProposalClient = async (proposalId: number, newClientId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('proposta')
      .update({ idcliente: newClientId })
      .eq('id', proposalId);

    if (error) throw error;
    return { success: true };
  } catch (e: any) {
    console.error("Error updating proposal client:", e.message);
    return { success: false, error: e.message };
  }
};

export const createNewClient = async (
  name: string,
  email?: string,
  phone?: string,
  proposalId?: number
): Promise<{ success: boolean; data?: Client; error?: string }> => {
  try {
    const payload: any = {
      nome_fantasia: name,
      email: email || null,
      telefone: phone || null,
      clientefrequente: false,
    };

    if (proposalId) {
      payload.cliente_propostas = [proposalId];
    }

    const { data, error } = await supabase
      .from('clientes')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    const newClient: Client = {
      id: data.id,
      nome: data.nome_fantasia || data.razao_social || name,
      nome_fantasia: data.nome_fantasia,
      razao_social: data.razao_social,
      avatar: data.avatar
    };

    return { success: true, data: newClient };
  } catch (e: any) {
    console.error("Error creating client:", e.message);
    return { success: false, error: e.message };
  }
};