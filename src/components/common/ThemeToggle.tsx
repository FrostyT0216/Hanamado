import GameIcon from '@/components/common/GameIcon';
import Tooltip from '@/components/common/Tooltip';
import { useTheme } from '@/context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Tooltip content={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'} position="left">
      <button
        onClick={toggleTheme}
        className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      >
        {theme === 'dark' ? (
          <GameIcon name="sun" className="w-[18px] h-[18px]" />
        ) : (
          <GameIcon name="moon" className="w-[18px] h-[18px]" />
        )}
      </button>
    </Tooltip>
  );
}
