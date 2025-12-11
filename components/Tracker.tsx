import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend 
} from 'recharts';
import { CheckCircle, PlusCircle, TrendingUp, Bot, Send, Target, Loader2, Gauge, AlertCircle, Trophy, User as UserIcon, Zap, Calculator, WifiOff } from 'lucide-react';
import { getLogs, saveLog, getLeaderboard } from '../services/storageService';
import { DailyLog, TeamMember, User } from '../types';
import { GoogleGenAI } from "@google/genai";
import { LOCAL_KNOWLEDGE_BASE, QUICK_ACTIONS } from '../constants';
import AdminPanel from './AdminPanel';
import EarningsCalculator from './Calculator';

// --- RAG SEARCH ENGINE UTILITIES ---

const STOP_WORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das', 
  'em', 'no', 'na', 'nos', 'nas', 
  'por', 'pelo', 'pela', 'pelos', 'pelas', 'para', 'com', 'sem', 'e', 'ou', 'mas', 'que', 'se', 'como', 'quando', 
  'onde', 'quem', 'qual', 'quais', 'quanto', 'quantos', 'é', 'são', 'foi', 'foram', 'ser', 'estar', 'ter', 'haver',
  'eu', 'tu', 'ele', 'ela', 'nós', 'vós', 'eles', 'elas', 'meu', 'teu', 'seu', 'nosso', 'vosso', 'isso', 'aquilo',
  'este', 'esta', 'esse', 'essa', 'aquele', 'aquela', 'muito', 'pouco', 'mais', 'menos', 'não', 'sim', 'então', 'logo'
]);

const stemWord = (word: string): string => {
  // Very basic Portuguese stemmer (suffix removal)
  return word.toLowerCase()
    .replace(/(ar|er|ir|or)$/, '') // verbs infinitive
    .replace(/(s|es)$/, '') // plurals
    .replace(/(indo|endo|ando)$/, '') // gerund
    .replace(/(mente)$/, '') // adverbs
    .replace(/(oso|osa)$/, '') // adjectives
    .replace(/(a|o|e)$/, ''); // gender/theme vowel
};

const tokenize = (text: string): string[] => {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w)) // Filter stop words and short words
    .map(stemWord);
};

interface KnowledgeChunk {
  title: string;
  content: string;
  tokens: string[];
  originalText: string;
}

// External RAG content to be integrated with the local knowledge base
const EXTERNAL_RAG_CONTENT = `
# ARQUIVO RAG 1 - RELATÓRIO DE ESTRATÉGIA COMERCIAL

## I. Introdução Estratégica: O Paradigma Data-Driven na Distribuição

A performance superior no setor de distribuição, marcado por uma concorrência acirrada e consumidores cada vez mais exigentes, exige uma redefinição das prioridades comerciais. O êxito vai além das táticas de venda isoladas; ele reside na construção de um framework estratégico robusto, centrado na inteligência de dados e na excelência do relacionamento com o cliente.

### 1.1. O Cenário Atual e a Convergência Vendas-Atendimento

A competitividade moderna demanda uma compreensão profunda do comportamento de compra e a capacidade de adaptar rapidamente as ofertas. Para os distribuidores, isso implica uma integração funcional onde as áreas de Vendas e Atendimento, incluindo Logística e Financeiro, operem em plena sintonia. O sucesso na execução de vendas depende de uma comunicação clara e sem ruídos entre todos os setores da organização, garantindo o escoamento eficiente dos produtos e o alinhamento das atividades-chave.

### 1.2. O Papel da Tecnologia como Habilitador de Produtividade

A eficiência de vendas (fazer mais com menos tempo) e a eficácia de vendas (fechar o negócio certo) são conceitos inseparáveis. Para maximizar a produtividade dos distribuidores, a tecnologia se torna crucial. A utilização de sistemas de Gestão de Relacionamento com o Cliente (CRM) e de Planejamento de Recursos Empresariais (ERP) permite a automação de fluxos de trabalho e o rastreamento detalhado de atividades.

A infraestrutura tecnológica adequada (CRM/ERP) é o pré-requisito fundamental para a eficácia do distribuidor. Quando os sistemas estão integrados, processos que demandavam horas passam a ser concluídos em minutos, reduzindo o estresse operacional e o retrabalho. Essa otimização de tempo é essencial, pois libera a equipe de tarefas burocráticas para que possam dedicar maior foco em atividades de alto valor, como a análise de dados, a criatividade na prospecção e a negociação consultiva com clientes. Sem essa fundação tecnológica sólida, o distribuidor não consegue alocar tempo para o relacionamento estratégico e a análise de desempenho.

## II. Inteligência Comercial: Transformando Histórico de Vendas em Oportunidades

O histórico de vendas é o principal ativo estratégico de um distribuidor, fornecendo a base empírica para todas as decisões de mercado. O seu uso eficiente move a operação de uma gestão reativa para um modelo preditivo.

### 2.1. Acesso Estratégico e Organização do Histórico de Clientes

Para que o histórico seja útil, ele precisa ser centralizado e de fácil acesso. Organizar os dados em um CRM é vital para uma gestão comercial estratégica, garantindo que os dados estejam sempre prontos para gerar percepções valiosas. A ausência de acesso imediato ao histórico de pedidos do cliente no cotidiano compromete significativamente a performance de vendas.

Ao monitorar o histórico de vendas, a gestão obtém acesso a indicadores criados a partir de dados reais e precisos, facilitando a tomada de decisões mais estratégicas. Especificamente no setor de distribuição, o histórico possibilita a previsão de tendências de consumo e a projeção de necessidades futuras, auxiliando na criação de estratégias assertivas, como promoções para produtos de baixa saída ou reforço de estoque para itens de alta procura em épocas sazonais.

Adicionalmente, o histórico serve como uma ferramenta de gestão de risco. Ele auxilia na identificação de consumidores que historicamente apresentam dificuldades em cumprir obrigações financeiras, orientando a decisão de vender ou não a prazo e influenciando diretamente a saúde financeira do negócio. A desorganização ou a falta de acesso ao histórico gera decisões subjetivas e resulta em tempo desperdiçado em retrabalho, diminuindo o foco na negociação e no relacionamento com o cliente.

### 2.2. Segmentação Acionável: A Matriz RFV (Recência, Frequência, Valor Monetário)

A Matriz RFV (ou RFM) é a metodologia mais eficaz para segmentar a base de clientes com base em seu comportamento transacional, permitindo a criação de campanhas personalizadas altamente direcionadas.

#### 2.2.1. Definição e Processo de Pontuação

A matriz utiliza três indicadores-chave para segmentação:
- **Recência (R)**: Mede o tempo decorrido desde a última compra. Clientes que compraram mais recentemente recebem pontuações mais altas, indicando maior engajamento.
- **Frequência (F)**: Avalia a regularidade com que o cliente realiza compras em um determinado período.
- **Valor Monetário (V)**: Reflete o gasto total ou médio do cliente.

O processo de segmentação RFV envolve classificar os clientes, tipicamente em uma escala de 1 a 5, onde os 20% melhores em cada critério recebem a pontuação máxima (5). Ao cruzar essas pontuações, o distribuidor pode identificar perfis distintos, desde os mais engajados até aqueles que estão próximos de se tornar inativos.

A aplicação da Matriz RFV é essencial, pois as campanhas genéricas deixaram de ser eficazes. A segmentação permite abordagens personalizadas para reativar clientes "dormindo", fidelizar compradores frequentes com benefícios VIP e estimular novos clientes a se tornarem recorrentes, tornando a comunicação mais eficaz.

##### Exemplo de Segmentação RFV e Ações Estratégicas:

| Segmento RFV | Perfil Comportamental | Ação Estratégica Primária | Objetivo |
|--------------|----------------------|---------------------------|----------|
| Clientes Leais (555) | Compra recente, frequente, alto gasto | Programas de fidelidade, ofertas exclusivas (VIP) | Retenção e estímulo ao Word-of-Mouth |
| Em Risco (4XX - 5XX) | Compra recente, mas frequência/valor declinando | Prospecção consultiva de Upsell/Cross-Sell | Aumentar Ticket Médio/Recorrência |
| Clientes Dormindo (1XX - 2XX) | Não compram há muito tempo, mas tinham histórico positivo | Campanhas de reativação com ofertas de alto valor | Recuperação de Receita Perdida |
| Novos Clientes (511)