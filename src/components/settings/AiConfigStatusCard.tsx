import { useEffect, useRef, useState } from 'react';
import GameIcon from '@/components/common/GameIcon';
import { useChatStore } from '@/store/chatStore';
import type { ApiConfig } from '@/types';

// ========== 服务商识别 ==========
//
// 余额接口（GET，Bearer 鉴权）：
// - Kimi (Moonshot):  https://api.moonshot.cn/v1/users/me/balance
//   返回: { code: 0, data: { available_balance, voucher_balance, cash_balance } }
// - DeepSeek:         https://api.deepseek.com/user/balance
//   返回: { is_available, balance_infos: [{ currency, total_balance, granted_balance, topped_up_balance }] }
// - OpenAI / 其他：无公开余额接口，仅显示"已配置"状态

type ProviderId = 'moonshot' | 'deepseek' | 'openai' | 'anthropic' | 'google' | 'custom';

interface ProviderInfo {
  id: ProviderId;
  name: string;
  /** 主色（用于 logo 背景或文字色） */
  color: string;
  /** 本地 logo SVG 路径（位于 public/providers/），无则显示首字母 */
  logo?: string;
  /** 平衡查询 URL（无则不支持） */
  balanceUrl?: string;
  /** 平衡解析函数；返回字符串数组（已格式化） */
  parseBalance?: (data: unknown) => BalanceLine[];
}

interface BalanceLine {
  label: string;
  value: string;
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'moonshot',
    name: 'Kimi',
    color: '#1c1c1e',
    logo: '/providers/kimi.svg',
    balanceUrl: 'https://api.moonshot.cn/v1/users/me/balance',
    parseBalance: (data) => {
      const d = (data as { data?: { available_balance?: number; voucher_balance?: number; cash_balance?: number } })?.data;
      if (!d) return [];
      const lines: BalanceLine[] = [];
      if (typeof d.available_balance === 'number') {
        lines.push({ label: '可用余额', value: `¥${d.available_balance.toFixed(2)}` });
      }
      if (typeof d.cash_balance === 'number') {
        lines.push({ label: '现金', value: `¥${d.cash_balance.toFixed(2)}` });
      }
      if (typeof d.voucher_balance === 'number') {
        lines.push({ label: '代金券', value: `¥${d.voucher_balance.toFixed(2)}` });
      }
      return lines;
    },
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    color: '#4D6BFE',
    logo: '/providers/deepseek.svg',
    balanceUrl: 'https://api.deepseek.com/user/balance',
    parseBalance: (data) => {
      const d = data as { balance_infos?: Array<{ currency?: string; total_balance?: string; granted_balance?: string; topped_up_balance?: string }> };
      const info = d?.balance_infos?.[0];
      if (!info) return [];
      const cur = info.currency === 'CNY' ? '¥' : info.currency === 'USD' ? '$' : '';
      const lines: BalanceLine[] = [];
      if (info.total_balance) {
        lines.push({ label: '总余额', value: `${cur}${info.total_balance}` });
      }
      if (info.topped_up_balance) {
        lines.push({ label: '充值', value: `${cur}${info.topped_up_balance}` });
      }
      if (info.granted_balance) {
        lines.push({ label: '赠送', value: `${cur}${info.granted_balance}` });
      }
      return lines;
    },
  },
  {
    id: 'openai',
    name: 'OpenAI',
    color: '#10a37f',
    logo: '/providers/openai.svg',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    color: '#1F4B4B',
    logo: '/providers/anthropic.svg',
  },
  {
    id: 'google',
    name: 'Google',
    color: '#4285F4',
    logo: '/providers/google.svg',
  },
];

/** 根据 baseUrl 识别服务商 */
function detectProvider(baseUrl: string): ProviderInfo {
  const url = baseUrl.toLowerCase();
  if (url.includes('moonshot.cn') || url.includes('kimi')) {
    return PROVIDERS.find((p) => p.id === 'moonshot')!;
  }
  if (url.includes('deepseek.com')) {
    return PROVIDERS.find((p) => p.id === 'deepseek')!;
  }
  if (url.includes('openai.com')) {
    return PROVIDERS.find((p) => p.id === 'openai')!;
  }
  if (url.includes('anthropic.com') || url.includes('claude')) {
    return PROVIDERS.find((p) => p.id === 'anthropic')!;
  }
  if (url.includes('googleapis.com') || url.includes('generativelanguage') || url.includes('gemini')) {
    return PROVIDERS.find((p) => p.id === 'google')!;
  }
  return {
    id: 'custom',
    name: '自定义',
    color: '#8e8e93',
  };
}

/** 从余额字符串中提取数值（支持 ¥/$ 前缀及纯数字） */
function parseBalanceValue(value: string): number | null {
  const match = value.replace(/,/g, '').match(/-?\d+\.?\d*/);
  return match ? parseFloat(match[0]) : null;
}

function isBalanceLow(value: string, threshold: number): boolean {
  if (threshold <= 0) return false;
  const num = parseBalanceValue(value);
  return num !== null && num < threshold;
}

type BalanceState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; lines: BalanceLine[] }
  | { status: 'error'; message: string };

interface AiConfigStatusCardProps {
  /** 紧凑模式：用于侧边栏等窄空间，一行显示服务商+余额 */
  compact?: boolean;
}

export default function AiConfigStatusCard({ compact = false }: AiConfigStatusCardProps) {
  const apiConfig = useChatStore((s) => s.apiConfig);
  const [balance, setBalance] = useState<BalanceState>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  // 紧凑模式：一行显示，极简
  if (compact) {
    return (
      <CompactStatusLine
        apiConfig={apiConfig}
        balance={balance}
        setBalance={setBalance}
        abortRef={abortRef}
      />
    );
  }

  // 未配置：直接显示提示
  if (!apiConfig || !apiConfig.apiKey) {
    return (
      <div className="mt-4 p-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <GameIcon name="warning" className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">AI 未配置</p>
            <p className="text-[11px] text-apple-text-secondary mt-0.5">
              请在「API 配置」中填写服务商会话信息以启用 AI 功能
            </p>
          </div>
        </div>
      </div>
    );
  }

  const provider = detectProvider(apiConfig.baseUrl);
  const supportsBalance = Boolean(provider.balanceUrl && provider.parseBalance);

  // 已配置但服务商不支持余额查询
  if (!supportsBalance) {
    return (
      <div className="mt-4 p-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/5">
        <div className="flex items-center gap-3">
          <ProviderLogo provider={provider} compact={false} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{provider.name}</p>
            <p className="text-[11px] text-apple-text-secondary mt-0.5 truncate">
              {apiConfig.model}
            </p>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
            已配置
          </span>
        </div>

        <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5 text-[11px] text-apple-text-secondary space-y-1">
          <div className="flex items-center justify-between">
            <span>Base URL</span>
            <span className="truncate ml-2 max-w-[180px]" title={apiConfig.baseUrl}>
              {apiConfig.baseUrl}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>API Key</span>
            <span className="font-mono ml-2 truncate max-w-[180px]">
              {apiConfig.apiKey.slice(0, 6)}••••••••
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 已配置且支持余额查询
  return (
    <BalanceCard
      apiConfig={apiConfig}
      provider={provider}
      balance={balance}
      setBalance={setBalance}
      abortRef={abortRef}
    />
  );
}

/** 侧边栏紧凑状态行：一行显示服务商 + 余额 */
function CompactStatusLine({
  apiConfig,
  balance,
  setBalance,
  abortRef,
}: {
  apiConfig: ApiConfig | null;
  balance: BalanceState;
  setBalance: (s: BalanceState) => void;
  abortRef: React.MutableRefObject<AbortController | null>;
}) {
  // 未配置
  if (!apiConfig || !apiConfig.apiKey) {
    return (
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-apple-text-secondary">
        <GameIcon name="warning" className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        <span>AI 未配置</span>
      </div>
    );
  }

  const provider = detectProvider(apiConfig.baseUrl);
  const supportsBalance = Boolean(provider.balanceUrl && provider.parseBalance);

  // 已配置但不支持余额：一行显示服务商 + 已配置
  if (!supportsBalance) {
    return (
      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <ProviderLogo provider={provider} compact />
          <span className="text-[11px] font-medium truncate">{provider.name}</span>
        </div>
        <span className="text-[10px] px-1.5 py-0 rounded-full font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 shrink-0">
          已配置
        </span>
      </div>
    );
  }

  // 已配置且支持余额
  return (
    <CompactBalanceLine
      apiConfig={apiConfig}
      provider={provider}
      balance={balance}
      setBalance={setBalance}
      abortRef={abortRef}
    />
  );
}

function CompactBalanceLine({
  apiConfig,
  provider,
  balance,
  setBalance,
  abortRef,
}: {
  apiConfig: ApiConfig;
  provider: ProviderInfo;
  balance: BalanceState;
  setBalance: (s: BalanceState) => void;
  abortRef: React.MutableRefObject<AbortController | null>;
}) {
  const threshold = useChatStore((s) => s.balanceWarningThreshold);
  const fetchBalance = async () => {
    if (!provider.balanceUrl) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBalance({ status: 'loading' });
    try {
      const resp = await fetch(provider.balanceUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiConfig.apiKey}` },
        signal: ctrl.signal,
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        setBalance({ status: 'error', message: `查询失败 (${resp.status})${txt ? `: ${txt.slice(0, 100)}` : ''}` });
        return;
      }
      const data = await resp.json();
      const lines = provider.parseBalance!(data);
      if (lines.length === 0) {
        setBalance({ status: 'error', message: '响应中没有可识别的余额字段' });
      } else {
        setBalance({ status: 'success', lines });
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setBalance({ status: 'error', message: e instanceof Error ? e.message : '网络请求失败' });
    }
  };

  useEffect(() => {
    void fetchBalance();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiConfig.baseUrl, apiConfig.apiKey, provider.id]);

  const mainLine = balance.status === 'success' ? balance.lines[0] : null;
  const isLow = mainLine ? isBalanceLow(mainLine.value, threshold) : false;

  return (
    <button
      onClick={fetchBalance}
      disabled={balance.status === 'loading'}
      className="mt-1 w-full flex items-center justify-between gap-2 rounded-md
        hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors
        disabled:opacity-60 text-left"
      title="点击刷新余额"
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <ProviderLogo provider={provider} compact />
        <span className="text-[11px] font-medium truncate">{provider.name}</span>
      </div>

      <span
        className={`text-[11px] font-semibold tabular-nums shrink-0 truncate ${
          isLow ? 'text-red-600 dark:text-red-400 balance-warning-breathe' : ''
        }`}
      >
        {balance.status === 'loading' && '查询中…'}
        {balance.status === 'error' && '查询失败'}
        {balance.status === 'success' && mainLine ? mainLine.value : '—'}
      </span>
    </button>
  );
}

/** 余额查询卡片（完整模式） */
function BalanceCard({
  apiConfig,
  provider,
  balance,
  setBalance,
  abortRef,
}: {
  apiConfig: ApiConfig;
  provider: ProviderInfo;
  balance: BalanceState;
  setBalance: (s: BalanceState) => void;
  abortRef: React.MutableRefObject<AbortController | null>;
}) {
  const threshold = useChatStore((s) => s.balanceWarningThreshold);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchBalance = async () => {
    if (!provider.balanceUrl) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBalance({ status: 'loading' });
    try {
      const resp = await fetch(provider.balanceUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiConfig.apiKey}` },
        signal: ctrl.signal,
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        setBalance({ status: 'error', message: `查询失败 (${resp.status})${txt ? `: ${txt.slice(0, 100)}` : ''}` });
        return;
      }
      const data = await resp.json();
      const lines = provider.parseBalance!(data);
      if (lines.length === 0) {
        setBalance({ status: 'error', message: '响应中没有可识别的余额字段' });
      } else {
        setBalance({ status: 'success', lines });
        setLastUpdated(new Date());
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setBalance({ status: 'error', message: e instanceof Error ? e.message : '网络请求失败' });
    }
  };

  useEffect(() => {
    void fetchBalance();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiConfig.baseUrl, apiConfig.apiKey, provider.id]);

  return (
    <div className="mt-4 p-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/5">
      <div className="flex items-center gap-3">
        <ProviderLogo provider={provider} compact={false} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{provider.name}</p>
          <p className="text-[11px] text-apple-text-secondary mt-0.5 truncate">{apiConfig.model}</p>
        </div>
        <button
          onClick={fetchBalance}
          disabled={balance.status === 'loading'}
          className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-black/10 dark:border-white/10
            hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors
            disabled:opacity-50 inline-flex items-center gap-1"
          title="刷新余额"
        >
          <GameIcon name="refresh" className={`w-3 h-3 ${balance.status === 'loading' ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5">
        {balance.status === 'loading' && <p className="text-[11px] text-apple-text-secondary">查询中…</p>}
        {balance.status === 'error' && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">{balance.message}</p>
        )}
        {balance.status === 'success' && (
          <div className="space-y-1.5">
            {balance.lines.map((line, i) => {
              const low = isBalanceLow(line.value, threshold);
              return (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <span className="text-apple-text-secondary">{line.label}</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      low ? 'text-red-600 dark:text-red-400 balance-warning-breathe' : ''
                    }`}
                  >
                    {line.value}
                  </span>
                </div>
              );
            })}
            {lastUpdated && (
              <p className="text-[10px] text-apple-text-secondary/70 mt-1.5">
                更新于 {lastUpdated.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5 text-[11px] text-apple-text-secondary space-y-1">
        <div className="flex items-center justify-between">
          <span>Base URL</span>
          <span className="truncate ml-2 max-w-[180px]" title={apiConfig.baseUrl}>
            {apiConfig.baseUrl}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>API Key</span>
          <span className="font-mono ml-2 truncate max-w-[180px]">
            {apiConfig.apiKey.slice(0, 6)}••••••••
          </span>
        </div>
      </div>
    </div>
  );
}

/** 服务商 Logo：优先使用本地收录的 SVG 图标，未收录则显示品牌色背景 + 首字母 */
function ProviderLogo({ provider, compact }: { provider: ProviderInfo; compact: boolean }) {
  return (
    <div
      className={`${compact ? 'w-5 h-5' : 'w-9 h-9'} rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden`}
      style={{ backgroundColor: provider.color }}
      aria-label={provider.name}
      title={provider.name}
    >
      {provider.logo ? (
        <img
          src={provider.logo}
          alt={provider.name}
          className={`${compact ? 'w-3 h-3' : 'w-5 h-5'} object-contain invert`}
          loading="lazy"
        />
      ) : (
        <span className={`text-white font-semibold ${compact ? 'text-[9px]' : 'text-sm'}`}>
          {provider.name.charAt(0)}
        </span>
      )}
    </div>
  );
}
