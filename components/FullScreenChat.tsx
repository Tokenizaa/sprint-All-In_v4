
import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Loader2, History, MessageCircle } from 'lucide-react';
import { User, ChatMessage } from '../types';
import { getLocalResponse } from '../services/ragService';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { LOCAL_KNOWLEDGE_BASE } from '../constants';

interface ChatProps { currentUser: User; }

const FullScreenChat: React.FC<ChatProps> = ({ currentUser }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem(`chat_history_${currentUser.id}`);
    return saved ? JSON.parse(saved) : [{ role: 'model', text: `🟢 Rádio Box: Olá ${currentUser.name}! Sou seu Engenheiro de Vendas.` }];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(`chat_history_${currentUser.id}`, JSON.stringify(messages));
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentUser.id]);

  const processMessage = async (text: string) => {
    setLoading(true);
    // @ts-ignore
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    try {
        if (!apiKey || apiKey.includes('PLACEHOLDER')) throw new Error("No API Key");
        
        const ai = new GoogleGenerativeAI(apiKey);
        const model = ai.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `System: Use this context: ${LOCAL_KNOWLEDGE_BASE}\nUser: ${text}`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const ans = response.text() || "Sem resposta.";
        setMessages(p => [...p, { role: 'model', text: ans, isLocal: false }]);
    } catch (e) {
        console.warn("Using Local RAG fallback");
        setTimeout(() => {
            const localAns = getLocalResponse(text);
            setMessages(p => [...p, { role: 'model', text: localAns, isLocal: true }]);
            setLoading(false);
        }, 800);
        return;
    }
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim()) return;
      const text = input;
      setInput('');
      setMessages(p => [...p, { role: 'user', text }]);
      processMessage(text);
  };

  return (
    <div className="flex h-screen w-full bg-race-carbon">
      <div className="flex-1 flex flex-col h-full relative min-w-0">
        <div className="bg-race-navy p-4 flex items-center gap-3 shadow-md z-10">
          <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-race-yellow"><Bot size={24} /></div>
          <div><h3 className="text-white font-bold">Engenheiro de Vendas</h3></div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-black/50 custom-scrollbar w-full">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-race-navy text-white rounded-tr-none' : 'bg-black border border-white/10 rounded-tl-none text-race-silver'}`}>
                {msg.text.split('\n').map((l, ix) => <p key={ix} className="mb-1">{l}</p>)}
                {msg.isLocal && <span className="text-[10px] text-race-yellow opacity-50 mt-2 block">Offline Mode</span>}
              </div>
            </div>
          ))}
          {loading && <div className="flex justify-start"><div className="bg-white p-4 rounded-2xl flex items-center gap-2 text-xs font-bold text-gray-400"><Loader2 className="animate-spin" size={14} /> Processando...</div></div>}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="p-4 bg-black/50 border-t border-white/10 flex gap-2">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Pergunte sobre sua estratégia..." className="flex-1 bg-black border border-white/10 focus:border-race-yellow rounded-xl px-4 text-white" disabled={loading}/>
          <button type="submit" disabled={loading} className="bg-race-yellow text-race-dark p-3 rounded-xl hover:scale-105 transition-all"><Send size={20} /></button>
        </form>
      </div>
    </div>
  );
};

export default FullScreenChat;
