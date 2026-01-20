import { supabase } from './supabaseClient';
import { logAction } from './logger';
import {
  Proposta, ItemProposta, Procedimento, Categoria, Modulo, Client, Unit,
  EnrichedProposal, EnrichedItem, ProposalStatus, ItemStatus
} from '../types';

// --- Interfaces for Context ---
export interface CatalogContext {
  modulos: Modulo[];
  categorias: Categoria[];
  procedimentos: Procedimento[];
  clientes: Client[];
  unidades: Unit[];
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

// --- Helper to Join Tables ---
function unrollEnrichedItems(items: EnrichedItem[]): EnrichedItem[] {
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

function enrichProposal(
  proposal: Proposta,
  allItems: ItemProposta[],
  context: CatalogContext
): EnrichedProposal {

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
    avatar: rawClient.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`,
    units: context.unidades.filter(u => String(u.empresaid) === String(rawClient.id))
  } : {
    id: proposal.idcliente || 'unknown',
    nome: displayName,
    nome_fantasia: displayName,
    razao_social: displayName,
    avatar: 'https://ui-avatars.com/api/?name=Unknown'
  };

  // 2. Resolve Unit
  const unit = context.unidades.find(u => u.id === proposal.unidade_id);

  // 3. Resolve Items
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

    let status: ItemStatus = (itemDef as any).status;

    if (!status) {
      status = 'PENDING';
    }

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
      status,
    };



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
    unidade: unit,
    itens: finalDisplayItems,
    totalValue
  };
};

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
    const unitRes = await safeFetch<Unit>('unidades');

    if (cliRes.error) console.error("Erro ao buscar clientes:", cliRes.error.message);
    if (modRes.error) console.error("Erro ao buscar módulos:", modRes.error.message);
    if (unitRes.error) console.error("Erro ao buscar unidades:", unitRes.error.message);

    // --- FILTERING LOGIC START ---
    let finalModulos = modRes.data || [];
    let finalCategorias = catRes.data || [];
    let finalProcedimentos = procRes.data || [];
    const finalUnits = unitRes.data || [];

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
        clientefrequente: rawClient.clientefrequente,
        modalidade: rawClient.modalidade,
        units: finalUnits.filter(u => String(u.empresaid) === String(rawClient.id))
      };
    });

    return {
      modulos: finalModulos,
      categorias: finalCategorias,
      procedimentos: finalProcedimentos,
      clientes: mappedClients,
      unidades: finalUnits,
    };
  } catch (e) {
    console.error("Critical error fetching catalog:", e);
    return { modulos: [], categorias: [], procedimentos: [], clientes: [], unidades: [] };
  }
};

export const getProposals = async (): Promise<EnrichedProposal[]> => {
  try {
    const { data: proposalsData, error: propError } = await supabase
      .from('proposta')
      .select('*')
      .order('created_at', { ascending: false }); // .abortSignal(AbortSignal.timeout(10000));

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
      const { data, error } = await supabase.from('itensproposta').select('*').in('id', allItemIds); // .abortSignal(AbortSignal.timeout(10000));

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
      .single(); // .abortSignal(AbortSignal.timeout(10000));

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
      const { data, error: itemsError } = await supabase.from('itensproposta').select('*').in('id', itemIds); // .abortSignal(AbortSignal.timeout(10000));
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
  // 1. Update Proposal Status
  const { error } = await supabase
    .from('proposta')
    .update({ status })
    .eq('id', id);

  if (error) {
    console.error("Error updating proposal status:", error);
    return;
  }

  await logAction('UPDATE', `Atualizou status da proposta #${id} para '${status}'`, { proposal_id: id, new_status: status });

  // 2. Cascading: Update All Items Status
  // Only cascade for specific statuses if needed, but per requirement:
  // "caso marquemos a proposta como "Aprovado" "Pendente" ou "Reprovado" TODOS os itens da proposta recebem o mesmo status"
  if (status === 'APPROVED' || status === 'PENDING' || status === 'REJECTED') {
    const itemStatus = status as ItemStatus; // Assuming mapped 1:1

    // Need to find all items for this proposal.
    // We can use the logic from getProposalById or deleteProposal to find items.
    // But a direct update with a subquery or known FK is best.
    // Since we don't have a guaranteed FK on items -> proposal in all schemas (sometimes array on proposal),
    // we must fetch the proposal's item list first if we want to be safe.

    const { data: proposalData } = await supabase
      .from('proposta')
      .select('itensproposta')
      .eq('id', id)
      .single();

    const itemIds = proposalData?.itensproposta || [];

    if (Array.isArray(itemIds) && itemIds.length > 0) {
      const updatePayload: { status: string, data_entregue?: string | null } = { status: itemStatus };
      if (status === 'APPROVED') updatePayload.data_entregue = new Date().toISOString();
      if (status === 'PENDING') updatePayload.data_entregue = null;

      const { error: itemsError } = await supabase
        .from('itensproposta')
        .update(updatePayload)
        .in('id', itemIds);

      if (itemsError) console.error("Error cascading status to items:", itemsError);
    }
  }
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
      } else {
        console.log(`Proposal ${proposalId} was not found, assuming already deleted. Cleanup complete.`);
      }

      await logAction('DELETE', `Excluiu proposta #${proposalId}`, { proposal_id: proposalId });
      return { success: true };
    }

    return { success: true };

  } catch (e: any) {
    console.error(`Exception while deleting proposal ${proposalId}:`, e.message);
    return { success: false, error: `Erro interno: ${e.message}` };
  }
};


export const updateItemStatus = async (itemId: number, status: ItemStatus, feedback?: string): Promise<void> => {
  // We now always send the 'status' field.
  // We ONLY keep data_entregue logic for backward compatibility or extra metadata.
  const updatePayload: { status?: string, data_entregue?: string | null, feedback?: string } = {
    status: status
  };

  if (feedback !== undefined) {
    updatePayload.feedback = feedback;
  }

  if (status === 'APPROVED') {
    updatePayload.data_entregue = new Date().toISOString();
  } else if (status === 'PENDING') {
    // Allow "un-delivering" an item
    updatePayload.data_entregue = null;
  }

  const { error } = await supabase
    .from('itensproposta')
    .update(updatePayload)
    .eq('id', itemId);

  if (error) {
    console.error("Error updating item status:", error);
  } else {
    await logAction('UPDATE', `Atualizou status do item #${itemId} para '${status}'`, { item_id: itemId, status, feedback });
  }
};

export const updateItemDetails = async (
  itemId: number,
  details: {
    preco?: number;
    data_para_entrega?: string;
    observacao?: string;
  }
): Promise<void> => {
  const { error } = await supabase
    .from('itensproposta')
    .update(details)
    .eq('id', itemId);

  if (error) {
    console.error("Error updating item details:", error);
  } else {
    await logAction('UPDATE', `Atualizou detalhes do item #${itemId}`, { item_id: itemId, details });
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

    await logAction('DELETE', `Removeu item #${itemId} da proposta #${proposalId}`, { proposal_id: proposalId, item_id: itemId });
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

    await logAction('CREATE', `Adicionou item à proposta #${proposalId}`, { proposal_id: proposalId, procedimento_id: itemData.procedimentoId });
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

  if (!error) {
    await logAction('UPDATE', `Atualizou preço do procedimento #${procedureId}`, { procedure_id: procedureId, prices: pricesToUpdate });
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
  }[],
  unitId?: number // Linked Unit ID
): Promise<boolean> => {
  try {
    // 1. Create Proposal record first (without items)
    const { data: propData, error: propError } = await supabase
      .from('proposta')
      .insert({
        idcliente: clientId,
        unidade_id: unitId || null,
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

    await logAction('CREATE', `Criou nova proposta para cliente ID ${clientId}`, { client_id: clientId, proposal_id: proposalId });
    return true;
  } catch (e) {
    console.error('Exception creating proposal:', e);
    return false;
  }
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

    await logAction('CREATE', `Criou novo procedimento: ${name}`, { name, category_id: categoryId });
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
    await logAction('UPDATE', `Renomeou procedimento #${id} para '${newName}'`, { procedure_id: id, new_name: newName });
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
    await logAction('DELETE', `Excluiu procedimento #${id}`, { procedure_id: id });
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
    await logAction('UPDATE', `Alterou cliente da proposta #${proposalId}`, { proposal_id: proposalId, new_client_id: newClientId });
    return { success: true };
  } catch (e: any) {
    console.error("Error updating proposal client:", e.message);
    return { success: false, error: e.message };
  }
};

export const duplicateProposal = async (sourceProposalId: number, targetClientId: string, targetUnitId: number | null): Promise<boolean> => {
  try {
    // 1. Fetch source proposal
    const { data: sourceProposal, error: fetchError } = await supabase
      .from('proposta')
      .select('*')
      .eq('id', sourceProposalId)
      .single();

    if (fetchError || !sourceProposal) {
      console.error('Error fetching source proposal for duplication:', fetchError);
      return false;
    }

    // 2. Fetch source items
    const rawItems = sourceProposal.itensproposta || (sourceProposal as any).itens_proposta;
    const itemIds = Array.isArray(rawItems) ? rawItems.filter((x: any) => x != null) : [];
    let sourceItems: ItemProposta[] = [];

    if (itemIds.length > 0) {
      const { data, error: itemsError } = await supabase.from('itensproposta').select('*').in('id', itemIds);
      if (itemsError) {
        console.error('Error fetching source items:', itemsError);
        return false;
      }
      sourceItems = (data || []) as ItemProposta[];
    }

    // 3. Create new proposal
    const { data: newProposalData, error: createError } = await supabase
      .from('proposta')
      .insert({
        idcliente: targetClientId,
        unidade_id: targetUnitId || null,
        created_at: new Date().toISOString(),
        status: 'PENDING',
        // Optional: Copy other fields if necessary, but keep it clean for now
      })
      .select()
      .single();

    if (createError || !newProposalData) {
      console.error('Error creating duplicated proposal:', createError);
      return false;
    }

    const newProposalId = newProposalData.id;

    // 4. Duplicate items
    if (sourceItems.length > 0) {
      const itemsPayload = sourceItems.map(item => ({
        idprocedimento: item.idprocedimento,
        quantidade: item.quantidade,
        preco: item.preco,
        observacao: item.observacao,
        status: 'PENDING', // Reset status
        data_para_entrega: item.data_para_entrega, // Keep delivery date expectation? Maybe.
        feedback: null, // Clear feedback
        data_entregue: null // Clear delivery date
      }));

      const { data: newItemsData, error: newItemsError } = await supabase
        .from('itensproposta')
        .insert(itemsPayload)
        .select('id');

      if (newItemsError) {
        console.error('Error creating duplicated items:', newItemsError);
        // We might want to revert the proposal creation here, but let's keep it simple
        return false;
      }

      // 5. Link new items to new proposal
      if (newItemsData && newItemsData.length > 0) {
        const newIds = newItemsData.map(x => x.id);
        await supabase
          .from('proposta')
          .update({ itensproposta: newIds })
          .eq('id', newProposalId);
      }
    }

    await logAction('CREATE', `Duplicou proposta #${sourceProposalId} para nova proposta #${newProposalId} (Cliente ${targetClientId})`, {
      original_proposal_id: sourceProposalId,
      new_proposal_id: newProposalId,
      target_client_id: targetClientId
    });

    return true;

  } catch (e: any) {
    console.error('Exception duplicating proposal:', e.message);
    return false;
  }
};

export const createDocSeg = async (docSeg: any) => {

  const { data, error } = await supabase
    .from('doc_seg')
    .insert([docSeg])
    .select()
    .single();

  if (error) {
    console.error('Error creating doc_seg:', error);
    throw error;
  }
  await logAction('CREATE', `Criou documento de segurança para item #${docSeg.doc}`, { doc_seg: docSeg });
  return data;
};

export const createNewClient = async (
  nomeFantasia: string,
  razaoSocial: string,
  email?: string,
  phone?: string,
  cnpj?: string,
  proposalId?: number
): Promise<{ success: boolean; data?: Client; error?: string }> => {
  try {
    const payload: any = {
      nome_fantasia: nomeFantasia,
      razao_social: razaoSocial,
      email: email || null,
      telefone: phone || null,
      cnpj: cnpj || null,
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
      nome: data.nome_fantasia || data.razao_social || nomeFantasia,
      nome_fantasia: data.nome_fantasia,
      razao_social: data.razao_social,
      cnpj: data.cnpj,
      avatar: data.avatar
    };

    await logAction('CREATE', `Cadastrou novo cliente: ${nomeFantasia}`, { client_name: nomeFantasia, client_id: data.id });
    return { success: true, data: newClient };
  } catch (e: any) {
    console.error("Error creating client:", e.message);
    return { success: false, error: e.message };
  }
};

export const createUnit = async (
  nome: string,
  clientId: string
): Promise<{ success: boolean; data?: Unit; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('unidades')
      .insert({
        nome_unidade: nome,
        empresaid: clientId
      })
      .select()
      .single();

    if (error) throw error;

    const newUnit: Unit = {
      id: data.id,
      nome_unidade: data.nome_unidade,
      empresaid: data.empresaid
    };

    await logAction('CREATE', `Criou nova unidade: ${nome}`, { unit_name: nome, client_id: clientId });
    return { success: true, data: newUnit };
  } catch (e: any) {
    console.error("Error creating unit:", e.message);
    return { success: false, error: e.message };
  }
};

export const updateClientModality = async (clientId: string, modality: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('clientes')
      .update({ modalidade: modality })
      .filter('id', 'eq', clientId); // Using filter locally or eq if exact match works

    if (error) throw error;
    await logAction('UPDATE', `Atualizou modalidade do cliente ${clientId} para '${modality}'`, { client_id: clientId, modality });
    return true;
  } catch (error) {
    console.error("Error updating client modality:", error);
    return false;
  }
};

export const uploadPdfAsset = async (file: File): Promise<{ publicUrl: string | null; error: string | null }> => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `pdf-assets/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents') // Assuming 'documents' bucket exists and is public/accessible
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading PDF asset:', uploadError);
      return { publicUrl: null, error: uploadError.message || JSON.stringify(uploadError) };
    }

    const { data } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    return { publicUrl: data.publicUrl, error: null };
  } catch (error: any) {
    console.error('Exception uploading PDF asset:', error);
    return { publicUrl: null, error: error.message || String(error) };
  }
};