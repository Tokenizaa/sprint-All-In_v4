import fetch from "node-fetch";
import { handleError } from '../utils/errorUtils.ts';

// Tipos para os dados da API externa
interface ExternalDistributor {
  id: string;
  usuario: string;
  nome: string;
  email: string;
  // Adicione outros campos conforme necessário
}

interface ExternalOrderItem {
  quantidade: string; // Na API vem como string
  // Adicione outros campos conforme necessário
}

interface ExternalOrder {
  id: string;
  cliente_nome: string;
  cliente_telefone: string;
  pagamento_confirmado: string; // "1" para pago, "0" para não pago
  itens: ExternalOrderItem[];
  // Adicione outros campos conforme necessário
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string | null;
}

// Estrutura de resposta da API para distribuidores
interface DistributorsApiResponse {
  _links: {
    next: { href: string };
    prev: { href: string };
    first: { href: string };
    last: { href: string };
    self: { href: string };
  };
  _infos: {
    count: number;
    total: number;
    page: number;
    total_pages: number;
  };
  distribuidores: ExternalDistributor[];
}

// Estrutura de resposta da API para clientes
interface ClientsApiResponse {
  _links: {
    next: { href: string };
    prev: { href: string };
    first: { href: string };
    last: { href: string };
    self: { href: string };
  };
  _infos: {
    count: number;
    total: number;
    page: number;
    total_pages: number;
  };
  clientes: any[]; // Definir estrutura mais específica se necessário
}

// Credenciais da API externa - Usar environment variables se disponíveis, caso contrário fallbacks
// Nota: Em produção, nunca use fallbacks hardcoded com credenciais reais.
const API_BASE_URL = "https://allinbrasil.com.br/api/v1";
// Use import.meta.env se estiver no Vite/Client, ou process.env se estiver no Node
const getEnv = (key: string) => {
  if (typeof process !== 'undefined' && process.env) return process.env[key];
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) return import.meta.env[key];
  return undefined;
}

const CLIENT_ID = getEnv('CLIENT_ID') || "Camp_c20d65784a390c";
const CLIENT_SECRET = getEnv('CLIENT_SECRET') || "62457f7a66c270904c63c1c02f929e64384383f4";

/**
 * Obtém o token de acesso usando o grant_type=client_credentials
 */
export async function getToken(): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "client_credentials"
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Failed to get token: ${response.status} ${errorText}` };
    }

    const data = await response.json() as TokenResponse;
    return { success: true, token: data.access_token };
  } catch (error) {
    const errorMessage = handleError(error, "Error getting access token");
    return { success: false, error: errorMessage };
  }
}

/**
 * Busca os dados de distribuidores
 */
export async function getDistribuidores(token: string): Promise<{ success: boolean; data?: ExternalDistributor[]; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/distribuidores`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Failed to fetch distributors: ${response.status} ${errorText}` };
    }

    const data = await response.json() as DistributorsApiResponse;
    return { success: true, data: data.distribuidores };
  } catch (error) {
    const errorMessage = handleError(error, "Error fetching distributors");
    return { success: false, error: errorMessage };
  }
}

/**
 * Busca os dados de clientes
 */
export async function getClientes(token: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/clientes`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Failed to fetch clients: ${response.status} ${errorText}` };
    }

    const data = await response.json() as ClientsApiResponse;
    return { success: true, data: data.clientes };
  } catch (error) {
    const errorMessage = handleError(error, "Error fetching clients");
    return { success: false, error: errorMessage };
  }
}

/**
 * Busca os dados de pedidos
 */
export async function getPedidos(token: string, startDate?: string): Promise<{ success: boolean; data?: ExternalOrder[] | any[]; error?: string }> {
  try {
    // Selecionar alguns campos úteis (o endpoint pode retornar outros campos também)
    const selectFields = 'cliente_nome,cliente_telefone,pagamento_confirmado,itens,distribuidor_indicador_id,tipo_nome,valor_total,data_adicionado';

    // Se for fornecida uma data de início, a API aceita o filtro data_adicionado__maior_igual
    const dateFilter = startDate ? `&data_adicionado__maior_igual=${encodeURIComponent(startDate)}` : '';

    const response = await fetch(`${API_BASE_URL}/pedidos?select=${selectFields}${dateFilter}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    // Tratamento especial para o caso de pedidos não encontrados
    if (response.status === 404) {
      const errorText = await response.text();
      return { 
        success: false, 
        error: `Pedidos endpoint not accessible (404). This is likely due to missing permissions ([pedidos] scope). Details: ${errorText}` 
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Failed to fetch orders: ${response.status} ${errorText}` };
    }

    // Parse dos dados de pedidos
    const rawData = await response.text();
    try {
      const data = JSON.parse(rawData);
      if (!data || !data.pedidos || !Array.isArray(data.pedidos)) {
        return { success: false, error: "Unexpected data structure for orders" };
      }

      // Mapear cada pedido para a estrutura solicitada pelo usuário
      const mapped = data.pedidos.map((order: any) => {
        // Extrair patrocinador (distribuidor indicador)
        const patrocinador = order.distribuidor_indicador_id ?? null;

        // Tipo de cliente: usar tipo_nome quando disponível ou cliente_tipo_pessoa_id
        const tipoCliente = order.tipo_nome ?? order.cliente_tipo_pessoa_id ?? null;

        // Situação do pedido (pagamento)
        const situacao = order.pagamento_confirmado === '1' ? 'Pago' : 'Não pago';

        // Total do pedido
        const total = order.valor_total ?? null;

        // Itens: extrair produto, modelo, sku, quantidade, valor_unitario/valor_total
        const itens = Array.isArray(order.itens) ? order.itens.map((it: any) => {
          // tentar obter SKU a partir de produto_opcoes quando presente
          let sku = null;
          try {
            if (it.produto_opcoes && Array.isArray(it.produto_opcoes) && it.produto_opcoes.length > 0) {
              const firstOption = it.produto_opcoes[0];
              sku = firstOption.produto_opcao_sku ?? firstOption.sku ?? null;
            }
          } catch (e) {
            sku = null;
          }

          return {
            produto: it.produto_descricao ?? it.produto_nome ?? null,
            modelo: it.produto_modelo ?? null,
            sku,
            quantidade: it.quantidade ? parseInt(it.quantidade, 10) : (it.quantidade_int ?? 0),
            valor_unitario: it.valor_unitario ?? it.valor_unitario_formatado ?? null,
            valor_total: it.valor_total ?? null
          };
        }) : [];

        return {
          id: order.id,
          cliente: order.cliente_nome ?? null,
          patrocinador,
          tipo_cliente: tipoCliente,
          telefone: order.cliente_telefone ?? null,
          total,
          situacao,
          itens,
          data_adicionado: order.data_adicionado ?? null
        };
      });

      return { success: true, data: mapped };
    } catch (parseError) {
      return { success: false, error: `Failed to parse orders data: ${parseError.message}` };
    }
  } catch (error) {
    const errorMessage = handleError(error, "Error fetching orders");
    return { success: false, error: errorMessage };
  }
}

/**
 * Fluxo completo para buscar dados da API externa
 */
export async function syncExternalData(): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Obter token de acesso
    const tokenResult = await getToken();
    if (!tokenResult.success || !tokenResult.token) {
      return { success: false, message: `Failed to get access token: ${tokenResult.error}` };
    }

    const token = tokenResult.token;

    // 2. Buscar distribuidores
    const distribuidoresResult = await getDistribuidores(token);
    if (!distribuidoresResult.success) {
      return { success: false, message: `Failed to fetch distributors: ${distribuidoresResult.error}` };
    }

    const distribuidores = distribuidoresResult.data || [];

    // 3. Buscar pedidos (tratando o caso especial de permissões)
    const pedidosResult = await getPedidos(token);
    let pedidos: ExternalOrder[] = [];
    let pedidosMessage = "";
    
    if (!pedidosResult.success) {
      // Se for um erro de permissão, registrar mensagem especial
      if (pedidosResult.error?.includes("missing permissions")) {
        pedidosMessage = "Pedidos data not accessible due to missing API permissions. Contact administrator to enable [pedidos] scope.";
      } else {
        pedidosMessage = `Pedidos fetch failed: ${pedidosResult.error}`;
      }
    } else {
      pedidos = pedidosResult.data || [];
    }

    // 4. Processar e sincronizar os dados conforme necessário
    
    console.log(`Successfully fetched ${distribuidores.length} distributors`);
    if (pedidosMessage) {
      console.log(pedidosMessage);
    } else {
      console.log(`Successfully fetched ${pedidos.length} orders`);
    }

    return { 
      success: true, 
      message: `Successfully synced ${distribuidores.length} distributors. ${pedidosMessage || `Successfully synced ${pedidos.length} orders.`}` 
    };
  } catch (error) {
    const errorMessage = handleError(error, "Error syncing external data");
    return { success: false, message: errorMessage };
  }
}