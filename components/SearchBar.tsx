import React, { useEffect, useRef } from 'react';

interface SearchBarProps {
  isOpen: boolean;
  value: string;
  matchCount: number;
  onChange: (code: string) => void;
  onClose: () => void;
  onJump: () => void;
}

/** ⌘F / Ctrl+F 基金代码搜索框：只接受数字（最多 6 位），Esc 关闭并恢复原筛选。 */
const SearchBar: React.FC<SearchBarProps> = ({ isOpen, value, matchCount, onChange, onClose, onJump }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const t = window.setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
      return () => window.clearTimeout(t);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'Enter') { e.preventDefault(); onJump(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); inputRef.current?.select(); return; }
    // 可打印字符只放行数字；功能键（退格/方向键等）照常
    if (e.key.length === 1 && !/[0-9]/.test(e.key) && !e.metaKey && !e.ctrlKey) e.preventDefault();
  };

  return (
    <div
      className="fixed top-3 right-4 z-[300] flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg px-3 py-2"
      role="search"
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        value={value}
        placeholder="基金代码"
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        onKeyDown={handleKeyDown}
        className="w-32 bg-transparent text-sm font-mono outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
        aria-label="按基金代码搜索"
      />
      <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
        {value ? `${matchCount} 只` : '全部'}
      </span>
      <button
        type="button"
        onClick={onClose}
        className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-lg leading-none"
        aria-label="关闭搜索"
        title="关闭 (Esc)"
      >
        ×
      </button>
    </div>
  );
};

export default SearchBar;
