import React, { useEffect, useRef } from 'react';

interface SearchBarProps {
  isOpen: boolean;
  /** 每次 ⌘F 自增：已打开时再次按下也重新聚焦并全选 */
  focusNonce: number;
  matchCount: number;
  value: string;
  onChange: (code: string) => void;
  onClose: () => void;
  onJump: () => void;
}

/** ⌘F / Ctrl+F 基金代码搜索框：接受多个代码（英文逗号+空格分隔），Esc 关闭并恢复原筛选。 */
const SearchBar: React.FC<SearchBarProps> = ({ isOpen, focusNonce, value, matchCount, onChange, onClose, onJump }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const t = window.setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
      return () => window.clearTimeout(t);
    }
  }, [isOpen, focusNonce]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'Enter') { e.preventDefault(); onJump(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); inputRef.current?.select(); return; }
    // 可打印字符只放行数字、英文逗号与空格（多代码用「, 」分隔）；功能键照常
    if (e.key.length === 1 && !/[0-9, ]/.test(e.key) && !e.metaKey && !e.ctrlKey) e.preventDefault();
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
        value={value}
        placeholder="基金代码，多个用「, 」分隔"
        onChange={(e) => onChange(e.target.value.replace(/[^0-9, ]/g, '').replace(/,(?! )/g, ', ').replace(/ {2,}/g, ' '))}
        onKeyDown={handleKeyDown}
        className="w-64 bg-transparent text-sm font-mono outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
        aria-label="按基金代码搜索"
      />
      {value.trim() !== '' && (
        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">{matchCount} 只</span>
      )}
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
