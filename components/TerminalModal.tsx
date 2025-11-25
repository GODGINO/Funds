
import React, { useState, useEffect, useRef } from 'react';

interface TerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCommand: (cmd: string) => string;
}

const TerminalModal: React.FC<TerminalModalProps> = ({ isOpen, onClose, onCommand }) => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [logs, setLogs] = useState<string[]>(['Welcome to Fund Terminal v1.0', "Type 'help' for commands.", '--------------------------------']);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (!input.trim()) return;
      
      const cmd = input.trim();
      setLogs(prev => [...prev, `> ${cmd}`]);
      setHistory(prev => [...prev, cmd]);
      setHistoryIndex(-1);
      
      if (cmd.toLowerCase() === 'clear') {
          setLogs([]);
      } else {
          const result = onCommand(cmd);
          if (result) {
            setLogs(prev => [...prev, result]);
          }
      }
      
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = Math.min(history.length - 1, historyIndex + 1);
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
        if (newIndex === history.length - 1 && historyIndex === history.length - 1) {
             setHistoryIndex(-1);
             setInput('');
        }
      }
    } else if (e.key === 'Escape') {
        onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-90 z-[100] flex justify-center items-center backdrop-blur-sm">
      <div className="w-full max-w-5xl h-[80vh] bg-black text-green-500 font-mono text-sm rounded-lg shadow-2xl flex flex-col border border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="bg-gray-800 px-4 py-2 flex justify-between items-center border-b border-gray-700 select-none">
          <span className="font-bold text-gray-300">Terminal</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>
        
        {/* Logs */}
        <div ref={logRef} className="flex-1 p-4 overflow-y-auto overflow-x-auto whitespace-pre">
            {logs.map((log, i) => (
                <div key={i} className="mb-1">{log}</div>
            ))}
        </div>

        {/* Input */}
        <div className="p-4 bg-gray-900 border-t border-gray-700 flex items-center">
            <span className="mr-2 font-bold text-blue-400">$</span>
            <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-600"
                placeholder="Type command..."
                autoComplete="off"
            />
        </div>
      </div>
    </div>
  );
};

export default TerminalModal;
