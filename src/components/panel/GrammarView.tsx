import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Loading from '@/components/common/Loading';

interface GrammarViewProps {
  sentence: string;
  explanation: string | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export default function GrammarView({ sentence, explanation, isLoading, error, onRetry }: GrammarViewProps) {
  return (
    <div className="space-y-4">
      {/* Quoted sentence */}
      <blockquote className="border-l-2 border-apple-blue pl-3 py-1 text-sm text-apple-text-secondary">
        {sentence}
      </blockquote>

      {/* Loading */}
      {isLoading && <Loading variant="skeleton" lines={5} />}

      {/* Error */}
      {error && !isLoading && (
        <div className="text-center py-6">
          <p className="text-sm text-red-500 mb-3">{error}</p>
          <button
            onClick={onRetry}
            className="text-sm text-apple-blue hover:underline"
          >
            重试
          </button>
        </div>
      )}

      {/* Content */}
      {explanation && !isLoading && (
        <div className="markdown-body text-apple-text dark:text-gray-100">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{explanation}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}