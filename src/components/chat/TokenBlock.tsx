import type { Token } from '@/types';
import Tooltip from '@/components/common/Tooltip';

interface TokenBlockProps {
  token: Token;
  onClick: (token: Token) => void;
}

export default function TokenBlock({ token, onClick }: TokenBlockProps) {
  return (
    <Tooltip content="点击查看详情">
      <span
        onClick={(e) => {
          e.stopPropagation();
          onClick(token);
        }}
        className="inline cursor-pointer rounded-md px-px py-px
          hover:bg-sky-400/30 dark:hover:bg-sky-400/25
          transition-colors duration-150 bubble-text"
      >
        {token.text}
      </span>
    </Tooltip>
  );
}