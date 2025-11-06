import React from 'react';

interface TagFilterProps {
  tags: string[];
  activeTag: string | null;
  onTagSelect: (tag: string | null) => void;
}

const COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-800 dark:text-blue-300' },
  { bg: 'bg-green-100 dark:bg-green-900/50', text: 'text-green-800 dark:text-green-300' },
  { bg: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-800 dark:text-red-300' },
  { bg: 'bg-yellow-100 dark:bg-yellow-900/50', text: 'text-yellow-800 dark:text-yellow-300' },
  { bg: 'bg-purple-100 dark:bg-purple-900/50', text: 'text-purple-800 dark:text-purple-300' },
  { bg: 'bg-pink-100 dark:bg-pink-900/50', text: 'text-pink-800 dark:text-pink-300' },
  { bg: 'bg-gray-200 dark:bg-gray-700/50', text: 'text-gray-800 dark:text-gray-300' },
];

const getTagColor = (tag: string) => {
  // A simple hashing function to get a deterministic color for each tag
  let hash = 0;
  if (tag.length === 0) return COLORS[6];
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; 
  }
  const index = Math.abs(hash % COLORS.length);
  return COLORS[index];
};

const TagFilter: React.FC<TagFilterProps> = ({ tags, activeTag, onTagSelect }) => {
  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 bg-white dark:bg-gray-900 rounded-lg shadow-md p-3 flex items-center flex-wrap gap-2">
      <button
        onClick={() => onTagSelect(null)}
        className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${
          activeTag === null
            ? 'bg-primary-600 text-white shadow'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
        }`}
      >
        All
      </button>
      {tags.map(tag => {
        const isActive = tag === activeTag;
        const { bg, text } = getTagColor(tag);
        return (
          <button
            key={tag}
            onClick={() => onTagSelect(tag)}
            className={`px-3 py-1 text-sm font-medium rounded-full transition-all duration-200 ease-in-out border ${
              isActive
                ? `${bg} ${text} shadow-md scale-105 border-current`
                : `${bg} ${text} border-transparent hover:shadow-sm hover:scale-102`
            }`}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
};

export default TagFilter;
