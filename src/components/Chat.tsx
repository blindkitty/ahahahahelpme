import { useState, useEffect, useRef } from 'react';
import { sendChatMessage, subscribeToChat, ChatMessage } from '../firebase';
import { cn } from '../utils/cn';

interface ChatProps {
  roomCode: string;
  senderName: string;
}

export function Chat({ roomCode, senderName }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(0);

  useEffect(() => {
    const unsubscribe = subscribeToChat(roomCode, (msgs) => {
      setMessages(msgs);
      
      // Check if new messages arrived while chat is closed
      if (!isOpen && msgs.length > prevMessagesLengthRef.current) {
        setHasUnread(true);
      }
      prevMessagesLengthRef.current = msgs.length;
    });
    return () => unsubscribe();
  }, [roomCode, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await sendChatMessage(roomCode, senderName, newMessage.trim());
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <div className={cn(
      "fixed bottom-4 left-4 z-50 flex flex-col transition-all duration-300 font-sans",
      isOpen ? "w-80 h-96" : "w-14 h-14"
    )}>
      {/* Toggle Button / Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "bg-blue-600 text-white shadow-lg flex items-center justify-center transition-all relative",
          isOpen ? "rounded-t-lg h-10 w-full justify-between px-4" : "rounded-full h-14 w-14 hover:scale-110"
        )}
      >
        {isOpen ? (
          <>
            <span className="font-bold text-sm">Чат комнаты</span>
            <span className="text-xs">▼</span>
          </>
        ) : (
          <>
            <span className="text-2xl">💬</span>
            {hasUnread && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
            )}
          </>
        )}
      </button>

      {/* Chat Body */}
      {isOpen && (
        <div className="flex-1 bg-white border border-gray-200 shadow-xl flex flex-col rounded-b-lg overflow-hidden">
          {/* Messages List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 text-xs mt-4">
                Нет сообщений. Напишите первое!
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender === senderName;
                return (
                  <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                    <div className={cn(
                      "max-w-[85%] rounded-lg px-3 py-1.5 text-sm break-words",
                      isMe 
                        ? "bg-blue-100 text-blue-900 rounded-br-none" 
                        : "bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm"
                    )}>
                      {!isMe && <div className="text-[10px] text-gray-500 font-bold mb-0.5">{msg.sender}</div>}
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSend} className="p-2 border-t bg-white flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Написать..."
              className="flex-1 px-3 py-1.5 text-sm border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 transform rotate-90">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
