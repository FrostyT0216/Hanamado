import GameIcon from '@/components/common/GameIcon';

interface VocabSearchBarProps {
  query: string;
  onChange: (query: string) => void;
}

export default function VocabSearchBar({ query, onChange }: VocabSearchBarProps) {
  return (
    <div className="relative">
      <GameIcon
        name="search"
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-apple-text-secondary"
      />
      <input
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="搜索单词、读音或释义..."
        className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.05]
          text-sm outline-none focus:ring-2 focus:ring-apple-blue/30 transition-all
          placeholder:text-apple-text-secondary"
      />
    </div>
  );
}