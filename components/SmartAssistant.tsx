import React, { useState, useRef, useEffect } from 'react';
import { InventoryItem, ChatMessage, Language } from '../types';
import { analyzeInventory } from '../services/aiService';
import { TRANSLATIONS } from '../constants';
import { Sparkles, Send, Bot, User as UserIcon, Loader2, X } from 'lucide-react';

interface SmartAssistantProps {
  locationName: string;
  items: InventoryItem[];
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

const SmartAssistant: React.FC<SmartAssistantProps> = ({ locationName, items, isOpen, onClose, language }) => {
  const [query, setQuery] = useState('');
  const t = TRANSLATIONS[language];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize welcome message when opened or language changes
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'model',
        text: `${t.welcomeMessage} **${locationName}**. ${t.howHelp}`,
        timestamp: Date.now()
      }]);
    }
  }, [language, locationName, t]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!query.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: query,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setIsLoading(true);

    try {
      const responseText = await analyzeInventory(locationName, items, userMessage.text, language);
      
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      console.error("SmartAssistant analysis error", err);
      const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: t.errorOccurred,
          timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 rtl:right-auto rtl:left-0 w-full border-s border-gray-200 dark:border-gray-800 sm:w-96 bg-white dark:bg-gray-900 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col border-l rtl:border-r rtl:border-l-0 border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="px-4 pb-4 pt-[max(env(safe-area-inset-top,1rem),1rem)] border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-brand-50 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white dark:bg-gray-900 rounded-lg shadow-sm">
            <Sparkles className="w-5 h-5 text-brand-600 dark:text-brand-500" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{t.smartAssistant}</h3>
            <p className="text-xs text-brand-600 dark:text-brand-400 font-medium">{t.poweredBy}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/50 dark:hover:bg-gray-700 rounded-full transition-colors">
          <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-gray-900/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === 'user' ? 'bg-gray-800 dark:bg-gray-600' : 'bg-brand-100 dark:bg-brand-900'
            }`}>
              {msg.role === 'user' ? (
                <UserIcon className="w-4 h-4 text-white" />
              ) : (
                <Bot className="w-4 h-4 text-brand-700 dark:text-brand-300" />
              )}
            </div>
            
            <div className={`max-w-[80%] rounded-2xl p-3 text-sm leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-gray-800 dark:bg-gray-800 text-white rounded-tr-sm rtl:rounded-tr-2xl rtl:rounded-tl-sm' 
                : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm text-gray-700 dark:text-gray-200 rounded-tl-sm rtl:rounded-tl-2xl rtl:rounded-tr-sm'
            }`}>
              {msg.text.split('\n').map((line, i) => (
                <React.Fragment key={i}>
                  {line}
                  {i < msg.text.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-brand-700 dark:text-brand-300" />
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl rounded-ts-sm p-4">
              <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="relative flex items-center">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={t.askPlaceholder}
            className="w-full pl-4 pr-12 rtl:pr-4 rtl:pl-12 py-3 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
          />
          <button
            onClick={handleSend}
            disabled={!query.trim() || isLoading}
            className="absolute right-2 rtl:left-2 rtl:right-auto p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:hover:bg-brand-600 transition-colors"
          >
            <Send className="w-4 h-4 rtl:rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SmartAssistant;
