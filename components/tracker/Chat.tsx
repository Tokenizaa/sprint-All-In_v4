
import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Loader2, SignalHigh, SignalLow, WifiOff } from 'lucide-react';
import { ChatMessage, User } from '../../types';
import { getLocalResponse } from '../../services/ragService';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { LOCAL_KNOWLEDGE_BASE } from '../../constants';

interface ChatProps {
  currentUser?: User;
}

const Chat: React.FC<ChatProps> = ({ currentUser }) => {
  const storageKey = currentUser ? `sprint_chat_history_${currentUser.id}` : 'sprint_chat_history';

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : [{ 
      role: 'model', 
      text: `🏁 **Rádio Box All-In Iniciado**

Estou conectado aos manuais da campanha. Me pergunte sobre:

- Estratégia de Venda Presencial
- Metas e Lucros
- Script de Abordagem
- Tecnologias dos Tênis`,
      isLocal: true 
    }];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(messages));
    scrollToBottom();
  }, [messages, storageKey]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const processMessage = async (text: string) => {
    setLoading(true);
    
    // Check for API key safely
    // @ts-ignore
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const hasApiKey = apiKey && apiKey.length > 10 && !apiKey.includes('PLACEHOLDER');

    // MODO ONLINE (COM GEMINI)
    if (isOnline && hasApiKey) {
      try {
        const ai = new GoogleGenerativeAI(apiKey);
        const systemPrompt = `
          Você é o 'Coach All-In', um especialista motivacional e estratégico em vendas de tênis ortopédicos/terapêuticos.
          
          SUA BASE DE CONHECIMENTO:
          ${LOCAL_KNOWLEDGE_BASE}

          REGRAS:
          1. Responda APENAS com base no texto acima.
          2. Seja breve, direto e motivador (estilo rádio de corrida/pitstop).
          3. Use formatação Markdown (negrito, listas) para facilitar a leitura rápida.
          4. Se a pergunta for vaga, motive o usuário a vender mais.
        `;

        const model = ai.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `${systemPrompt}\n\nO usuário perguntou: "${text}". Responda como Coach.`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        
        const ans = response.text() || "Sem resposta.";
        setMessages(p => [...p, { role: 'model', text: ans, isLocal: false, timestamp: Date.now() }]);
        setLoading(false);
        return;

      } catch (e) {
        console.warn("Gemini API falhou, mudando para modo Offline Local...", e);
        // Fallback to local handled below
      }
    }

    // MODO OFFLINE (RAG LOCAL)
    // Simula um tempo de "pensamento" para parecer natural
    setTimeout(() => {
        const localAns = getLocalResponse(text);
        setMessages(p => [...p, { 
          role: 'model', 
          text: localAns, 
          isLocal: true,
          timestamp: Date.now()
        }]);
        setLoading(false);
    }, 600); // 600ms de delay artificial para UX
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim()) return;
      const text = input;
      setInput('');
      setMessages(p => [...p, { role: 'user', text, timestamp: Date.now() }]);
      processMessage(text);
  };

  const handleClearChat = () => {
    if(confirm('Limpar histórico do chat?')) {
      setMessages([{ role: 'model', text: "Histórico limpo. Vamos começar de novo! Qual sua dúvida?", isLocal: true }]);
    }
  }

  // Renderizador de Markdown simplificado para segurança e leveza
  const renderMessageText = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('### ')) return <h3 key={i} className="text-race-yellow font-bold text-lg mt-2 mb-1">{line.replace('### ', '')}</h3>;
      if (line.startsWith('**') && line.endsWith('**')) return <strong key={i} className="block text-white mt-2">{line.replace(/\*\*/g, '')}</strong>;
      if (line.startsWith('- ')) return <li key={i} className="ml-4 list-disc text-gray-300">{line.replace('- ', '')}</li>;
      return <p key={i} className="mb-1 min-h-[1.2em]">{line.replace(/\*\*(.*?)\*\*/g, (match, p1) => p1)}</p>; // Basic bold regex for inline
    });
  };

  return (
    <div className="flex flex-col h-full bg-race-carbon/50 rounded-2xl border border-white/10 overflow-hidden relative shadow-2xl">
      
      {/* Header */}
      <div className="bg-race-navy p-3 md:p-4 flex justify-between items-center shadow-md z-10 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-race-yellow/20 rounded-full flex items-center justify-center text-race-yellow border border-race-yellow/50 shadow-[0_0_10px_rgba(250,255,0,0.2)]">
            <Bot size={20} />
          </div>
          <div>
            <h3 className="text-white font-bold font-display italic tracking-wide">COACH BOX</h3>
            <div className="flex items-center gap-1.5">
               {isOnline ? 
                 <span className="flex items-center gap-1 text-[10px] text-race-green font-bold uppercase tracking-wider"><SignalHigh size={10} /> Online (IA)</span> : 
                 <span className="flex items-center gap-1 text-[10px] text-race-yellow font-bold uppercase tracking-wider"><WifiOff size={10} /> Modo Offline</span>
               }
            </div>
          </div>
        </div>
        <button onClick={handleClearChat} className="text-xs text-gray-500 hover:text-white transition-colors">
          Limpar
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/40">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            <div 
              className={`
                max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-lg relative
                ${msg.role === 'user' 
                  ? 'bg-race-yellow text-race-dark rounded-tr-none font-medium' 
                  : 'bg-race-carbon border border-white/10 text-gray-200 rounded-tl-none'}
              `}
            >
              {msg.role === 'model' ? (
                 <div className="markdown-body">
                    {renderMessageText(msg.text)}
                    {msg.isLocal && (
                        <div className="mt-3 pt-2 border-t border-white/5 flex items-center gap-1 text-[9px] text-gray-500 uppercase tracking-wider font-bold">
                            <SignalLow size={10} /> Resposta da Base Local
                        </div>
                    )}
                 </div>
              ) : (
                 <p>{msg.text}</p>
              )}
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-race-carbon border border-white/10 p-3 rounded-2xl rounded-tl-none flex items-center gap-2 text-xs font-bold text-gray-400">
              <Loader2 className="animate-spin text-race-yellow" size={14} /> 
              Analizando estratégia...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-race-navy border-t border-white/10">
        <form onSubmit={handleSubmit} className="flex gap-2 relative">
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder={isOnline ? "Pergunte ao Coach..." : "Busca offline (Ex: 'Venda presencial')"}
            className="flex-1 bg-black/50 border border-white/10 focus:border-race-yellow focus:ring-1 focus:ring-race-yellow/50 rounded-xl pl-4 pr-12 py-3 text-white text-sm placeholder-gray-500 transition-all outline-none"
            disabled={loading}
          />
          <button 
            type="submit" 
            disabled={loading || !input.trim()} 
            className="absolute right-1 top-1 bottom-1 aspect-square bg-race-yellow text-race-dark rounded-lg flex items-center justify-center hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={18} />
          </button>
        </form>
        <div className="text-[9px] text-center text-gray-600 mt-2 font-mono uppercase tracking-widest">
           All-In Intelligence System v2.5
        </div>
      </div>
    </div>
  );
};

export default Chat;
