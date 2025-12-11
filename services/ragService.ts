
import { LOCAL_KNOWLEDGE_BASE } from '../constants';
import { GoogleGenAI, FunctionDeclaration } from "@google/genai";
import { createClient } from '@supabase/supabase-js';
import { fetchUserStats } from './apiIntegrationService';

// --- CONFIGURAÇÃO SUPABASE (CLIENT-SIDE LEVE) ---
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseKey = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = (supabaseUrl && supabaseKey && !supabaseKey.includes('PLACEHOLDER')) ? createClient(supabaseUrl, supabaseKey) : null;

// --- RAG LOCAL (LEGADO/OFFLINE) ---

// Stop Words em Português expandidas
const STOP_WORDS = new Set([
  'a', 'as', 'o', 'os', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 
  'por', 'pelo', 'pela', 'pelos', 'pelas', 'para', 'com', 'sem', 'e', 'ou', 'mas', 'que', 
  'se', 'como', 'onde', 'quem', 'qual', 'quais', 'quanto', 'quantos', 'é', 'são', 'foi', 
  'foram', 'ser', 'estar', 'ter', 'haver', 'eu', 'tu', 'ele', 'ela', 'nós', 'vós', 'eles', 
  'elas', 'meu', 'teu', 'seu', 'nosso', 'vosso', 'isso', 'aquilo', 'este', 'esta', 'esse', 
  'essa', 'aquele', 'aquela', 'muito', 'pouco', 'mais', 'menos', 'não', 'sim', 'então', 
  'logo', 'ola', 'olá', 'bom', 'dia', 'tarde', 'noite', 'gostaria', 'saber', 'sobre', 
  'pode', 'me', 'falar', 'ajudar', 'bot', 'chat', 'ia', 'fazer', 'dizer'
]);

// Normaliza o texto: remove acentos, pontuação e converte para minúsculas
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^\w\s]/g, '') // Remove pontuação
    .trim();
};

// Stemming Otimizado para Português (RSLP Simplificado)
const stemWord = (word: string): string => {
  word = word.toLowerCase().trim();
  if (word.length < 3) return word;

  const suffixPatterns = [
    /(s|es)$/, // Plural
    /(r|ar|er|ir|or)$/, // Verbos infinitivos
    /(ndo|nda|do|da)$/, // Gerúndio/Particípio
    /(ment|mente)$/, // Advérbios
    /(cao|ao|oes)$/, // Substantivos
    /(vel|bil)$/,
    /(inhav|inha)$/ // Diminutivos
  ];

  let stem = word;
  for (const pattern of suffixPatterns) {
     if (pattern.test(stem)) {
        stem = stem.replace(pattern, '');
        break; // Aplica apenas uma regra de sufixo por vez para evitar overstemming
     }
  }
  
  // Normalização de gênero simples (menino/menina -> menin)
  if (stem.length > 3 && /[ao]$/.test(stem)) {
      stem = stem.slice(0, -1);
  }

  return stem;
};

// Tokeniza: quebra o texto em palavras úteis e aplica stemming
const tokenize = (text: string): string[] => {
  return normalizeText(text)
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    .map(stemWord);
};

interface KnowledgeChunk {
  id: number;
  title: string;
  content: string;
  tokens: string[];
  originalText: string;
  section: string;
}

// Processa o Markdown em blocos semânticos (baseados em cabeçalhos)
const processKnowledgeBase = (text: string): KnowledgeChunk[] => {
  const lines = text.split('\n');
  const chunks: KnowledgeChunk[] = [];
  let currentTitle = 'Informações Gerais';
  let currentSection = 'Geral';
  let currentBuffer: string[] = [];
  let idCounter = 0;

  const saveChunk = () => {
    if (currentBuffer.length > 0) {
      const content = currentBuffer.join('\n').trim();
      if (content.length > 20) { // Ignora chunks muito pequenos
        const fullText = `${currentTitle} ${content}`;
        chunks.push({
          id: idCounter++,
          title: currentTitle.replace(/#/g, '').trim(),
          content: content,
          tokens: tokenize(fullText),
          originalText: content,
          section: currentSection
        });
      }
      currentBuffer = [];
    }
  };

  lines.forEach(line => {
    // Detecta cabeçalhos Markdown (#, ##, ###)
    if (line.match(/^#{1,3}\s/)) {
      saveChunk(); // Salva o acumulado anterior
      currentTitle = line.replace(/^#{1,3}\s/, '').trim();
      if (line.startsWith('# ')) currentSection = currentTitle; // Define seção principal
    } else {
      if (line.trim().length > 0) {
        currentBuffer.push(line);
      }
    }
  });
  saveChunk(); // Salva o último

  return chunks;
};

// Inicializa a base de conhecimento processada
const KNOWLEDGE_CHUNKS = processKnowledgeBase(LOCAL_KNOWLEDGE_BASE);

export const getLocalResponse = (query: string): string => {
  const queryTokens = tokenize(query);
  const rawQuery = normalizeText(query);

  if (queryTokens.length === 0) {
    return "Olá! Sou seu Coach All-In (Modo Offline). \n\nPosso te ajudar com:\n- **Estratégias de Venda** (Pilar Presencial, Digital...)\n- **Produtos** (Magnetoterapia, Modelos...)\n- **Planos de Negócio** (Comissões, Investimento...)\n- **Sprint Final** (Metas, Lucros...)";
  }

  // Algoritmo de Pontuação (Scoring)
  const scoredChunks = KNOWLEDGE_CHUNKS.map(chunk => {
    let score = 0;
    let termMatches = 0;

    // 1. Correspondência de Termos (Stemmed)
    queryTokens.forEach(qToken => {
      if (chunk.tokens.includes(qToken)) {
        termMatches++;
        score += 10; // Peso base por palavra encontrada
        
        // Bônus se a palavra estiver no título
        const titleTokens = tokenize(chunk.title);
        if (titleTokens.includes(qToken)) {
            score += 20;
        }
      }
    });

    // 2. Correspondência de Frase Exata (Boost de Relevância)
    const normalizedContent = normalizeText(chunk.originalText);
    if (normalizedContent.includes(rawQuery)) {
        score += 50;
    }

    // 3. Penalidade por Tamanho (Normalização TF-IDF simplificada)
    // Evita que textos muito longos ganhem só por terem mais palavras
    if (chunk.tokens.length > 0) {
        score = score / Math.log10(chunk.tokens.length + 10);
    }

    return { ...chunk, score, termMatches };
  });

  // Filtra resultados com pontuação mínima
  const results = scoredChunks
    .filter(c => c.score > 3) 
    .sort((a, b) => b.score - a.score);

  const bestMatch = results[0];
  const relatedMatches = results.slice(1, 3); // Pega mais 2 relacionados

  if (!bestMatch) {
    return `### ⚠️ Sem resultados precisos\n\nNão encontrei informações específicas sobre "**${query}**" no meu banco de dados offline.\n\nTente usar palavras-chave como:\n- *Venda Presencial*\n- *Magnetoterapia*\n- *Comissão*\n- *Abordagem*`;
  }

  // Formatação da Resposta em Markdown
  let response = `### 🎯 ${bestMatch.title}\n\n${bestMatch.originalText}\n`;

  if (relatedMatches.length > 0) {
    response += `\n\n---\n**💡 Veja também:**\n`;
    relatedMatches.forEach(match => {
        response += `- **${match.title}**: ${match.originalText.slice(0, 80)}...\n`;
    });
  }

  return response;
};

// --- RAG REMOTO + FUNCTION CALLING (FERRAMENTAS) ---

export const getRemoteVectorResponse = async (query: string, apiKey: string): Promise<string | null> => {
  if (!supabase) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Correct usage for @google/genai v1.0.0+
    const result = await ai.models.embedContent({
        model: "text-embedding-004",
        contents: query
    });
    // Fix: Access embeddings property which contains an array, and get the values from the first embedding.
    const embedding = result.embeddings?.[0]?.values;

    if (!embedding) return null;

    const { data: documents, error } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: 0.5, 
      match_count: 3        
    });

    if (error) {
      console.warn("Erro na busca vetorial:", error.message);
      return null;
    }

    if (!documents || documents.length === 0) {
      return null; 
    }

    let finalResponse = "";
    documents.forEach((doc: any, index: number) => {
        if (index === 0) finalResponse += `### 🧠 Informação Encontrada (Base Vetorial)\n\n${doc.content}\n\n`;
        else finalResponse += `---\n\n${doc.content}\n\n`;
    });

    return finalResponse;

  } catch (e) {
    console.error("Falha no processo de RAG Remoto:", e);
    return null;
  }
};

// --- CHAT COM FERRAMENTAS ---

const getUserStatsTool: FunctionDeclaration = {
  name: "get_user_stats",
  description: "Retorna as estatísticas de vendas, ranking e histórico de compras do usuário atual. Use isso quando o usuário perguntar sobre 'minhas vendas', 'meu desempenho', 'ranking', 'metas' ou 'resultados'.",
};

export const chatWithTools = async (query: string, apiKey: string, userId: string): Promise<{ text: string, usedTool: boolean } | null> => {
  if(!userId) return null;

  const ai = new GoogleGenAI({ apiKey });
  
  // 1. Tentar contexto vetorial primeiro para enriquecer o prompt
  let vectorContext = "";
  try {
     const vectorRes = await getRemoteVectorResponse(query, apiKey);
     if (vectorRes) vectorContext = vectorRes;
  } catch (e) { console.warn("Vector context failed", e); }

  // Use ai.chats.create for standard chat interactions in the new SDK
  const chat = ai.chats.create({
    model: "gemini-2.5-flash",
    config: {
        tools: [{
            functionDeclarations: [getUserStatsTool]
        }]
    },
    history: [
      {
        role: "user",
        parts: [{ text: `Você é o Coach de Vendas All-In.
        CONTEXTO DE CONHECIMENTO BASE (USE SE NECESSÁRIO):
        ${LOCAL_KNOWLEDGE_BASE}
        
        CONTEXTO VETORIAL ADICIONAL:
        ${vectorContext}

        Se o usuário perguntar sobre dados pessoais dele (vendas, ranking, metas), use a ferramenta 'get_user_stats'.
        Se for pergunta genérica, use o contexto acima. 
        Responda de forma curta, motivadora e use formatação Markdown (negrito, listas).` }]
      }
    ]
  });

  const result = await chat.sendMessage({ message: query });
  // Access functionCalls as a property, not a method
  const call = result.functionCalls?.[0];

  if (call) {
    // 2. Gemini pediu para usar uma ferramenta
    if (call.name === "get_user_stats") {
       console.log("🛠️ Tool Call: getUserStats for", userId);
       const apiData = await fetchUserStats(userId);
       
       const toolResult = [{
         functionResponse: {
            name: "get_user_stats",
            response: { name: "get_user_stats", content: apiData }
         }
       }];
       
       // 3. Enviar o resultado da ferramenta de volta para o Gemini using sendMessage with message part
       const finalResult = await chat.sendMessage({ message: toolResult });
       return { text: finalResult.text || "Sem resposta.", usedTool: true };
    }
  }

  return { text: result.text || "Sem resposta.", usedTool: false };
};
