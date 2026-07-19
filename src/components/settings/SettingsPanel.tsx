import { useState, useEffect, useRef, type ReactNode, type ChangeEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import GameIcon from '@/components/common/GameIcon';
import CustomScrollbar from '@/components/common/CustomScrollbar';
import Modal from '@/components/common/Modal';
import type { IconName } from '@/components/icons/iconData';
import { useChatStore } from '@/store/chatStore';
import { testConnection } from '@/services/ai';
import { generateBingImageUrl } from '@/services/bing';
import AiConfigStatusCard from '@/components/settings/AiConfigStatusCard';
import {
  ALL_CATEGORIES,
  CATEGORY_DESCRIPTIONS,
  CATEGORY_LABELS,
  applyImport,
  downloadBackup,
  exportData,
  formatBytes,
  formatExportTime,
  parseBackupFile,
  summarizeBackup,
  type BackupPayload,
  type DataCategory,
  type ImportSummary,
} from '@/services/dataTransfer';
import type {
  ApiConfig,
  FontSize,
  GlassBlur,
  BubbleRadius,
  BackgroundDecoration,
  BackgroundImage,
  MotionLevel,
  BubbleStyle,
} from '@/types';

const ACCENT_PRESETS = [
  { name: '苹果蓝', color: '#007aff' },
  { name: '樱花粉', color: '#ff6b8a' },
  { name: '抹茶绿', color: '#34c759' },
  { name: '暖橘', color: '#ff9500' },
  { name: '薰衣草', color: '#af52de' },
];

type SettingsCategory = 'api' | 'appearance' | 'data' | 'about';

const CATEGORIES: { id: SettingsCategory; label: string; icon: IconName }[] = [
  { id: 'api', label: 'API 配置', icon: 'settings' },
  { id: 'appearance', label: '外观', icon: 'sparkles' },
  { id: 'data', label: '数据', icon: 'database' },
  { id: 'about', label: '关于', icon: 'info' },
];

/* 通用分段控件 */
function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="flex gap-1 p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.06]">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200
              ${value === opt.value
                ? 'bg-white dark:bg-white/15 text-apple-text dark:text-white shadow-sm'
                : 'text-apple-text-secondary hover:text-apple-text dark:hover:text-white/80'
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* 卡片选择控件：带视觉预览 */
function VisualCard<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; preview: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="grid grid-cols-3 gap-2.5">
        {options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all duration-200
                ${isSelected
                  ? 'border-apple-blue bg-apple-blue/5'
                  : 'border-black/8 dark:border-white/8 hover:border-black/15 dark:hover:border-white/15'
                }`}
            >
              {opt.preview}
              <span
                className={`text-[11px] transition-colors ${
                  isSelected
                    ? 'text-apple-blue font-medium'
                    : 'text-apple-text-secondary'
                }`}
              >
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const closeSettings = useChatStore((s) => s.setSettingsOpen);
  const apiConfig = useChatStore((s) => s.apiConfig);
  const setApiConfig = useChatStore((s) => s.setApiConfig);
  const balanceWarningThreshold = useChatStore((s) => s.balanceWarningThreshold);
  const setBalanceWarningThreshold = useChatStore((s) => s.setBalanceWarningThreshold);
  const accentColor = useChatStore((s) => s.accentColor);
  const setAccentColor = useChatStore((s) => s.setAccentColor);
  const appearance = useChatStore(
    useShallow((s) => ({
      fontSize: s.fontSize,
      glassBlur: s.glassBlur,
      bubbleRadius: s.bubbleRadius,
      backgroundDecoration: s.backgroundDecoration,
      backgroundImage: s.backgroundImage,
      motionLevel: s.motionLevel,
      backgroundImageUrl: s.backgroundImageUrl,
      bubbleStyle: s.bubbleStyle,
    }))
  );
  const setAppearance = useChatStore((s) => s.setAppearance);
  const bingImageUrl = useChatStore((s) => s.bingImageUrl);
  const setBingImageUrl = useChatStore((s) => s.setBingImageUrl);

  // API Config form state
  const [baseUrl, setBaseUrl] = useState(apiConfig?.baseUrl ?? 'https://api.openai.com/v1');
  const [apiKey, setApiKey] = useState(apiConfig?.apiKey ?? '');
  const [model, setModel] = useState(apiConfig?.model ?? 'gpt-4o-mini');
  const [temperature, setTemperature] = useState(apiConfig?.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState(apiConfig?.maxTokens ?? 1024);
  const [warningThreshold, setWarningThreshold] = useState(balanceWarningThreshold);
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('api');
  // 外部跳转确认弹窗（仅对非 frospon.top 站点弹出）
  const [pendingLink, setPendingLink] = useState<{ url: string; label: string } | null>(null);

  // ===== 数据备份与恢复 =====
  // 导出：默认全选
  const [exportCategories, setExportCategories] = useState<Set<DataCategory>>(
    () => new Set(ALL_CATEGORIES)
  );
  // 导出确认弹窗（包含 API Key 时再次提示）
  const [pendingExport, setPendingExport] = useState<BackupPayload | null>(null);
  // 导入：备份文件解析结果
  const [importPayload, setImportPayload] = useState<BackupPayload | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importCategories, setImportCategories] = useState<Set<DataCategory>>(
    () => new Set()
  );
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const toggleExportCategory = (cat: DataCategory) => {
    setExportCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleExportClick = () => {
    if (exportCategories.size === 0) return;
    const payload = exportData(Array.from(exportCategories));
    // 如果包含 API 配置且存在 apiKey，弹出安全确认
    if (exportCategories.has('api') && payload.data.apiConfig?.apiKey) {
      setPendingExport(payload);
    } else {
      downloadBackup(payload);
    }
  };

  const confirmExport = () => {
    if (!pendingExport) return;
    downloadBackup(pendingExport);
    setPendingExport(null);
  };

  const handleImportClick = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        const payload = parseBackupFile(text);
        const summary = summarizeBackup(payload);
        setImportPayload(payload);
        setImportSummary(summary);
        // 默认勾选备份文件中实际存在的所有类别
        setImportCategories(new Set(summary.availableCategories));
      } catch (err) {
        setImportError(err instanceof Error ? err.message : '读取备份文件失败');
      }
    };
    reader.onerror = () => setImportError('读取文件失败');
    reader.readAsText(file);
  };

  const toggleImportCategory = (cat: DataCategory) => {
    setImportCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const closeImportModal = () => {
    setImportPayload(null);
    setImportSummary(null);
    setImportCategories(new Set());
    setImportError(null);
  };

  const confirmImport = () => {
    if (!importPayload || importCategories.size === 0) return;
    setIsImporting(true);
    try {
      applyImport(importPayload, Array.from(importCategories));
      // 短暂延迟让 UI 显示「正在导入…」状态后刷新页面以重新加载所有 store
      setTimeout(() => {
        window.location.reload();
      }, 200);
    } catch (err) {
      setIsImporting(false);
      setImportError(err instanceof Error ? err.message : '导入失败');
    }
  };

  const handleExternalLink = (url: string, label: string) => {
    try {
      const host = new URL(url).hostname;
      // frospon.top 为本站友链/自有博客，直接跳转
      if (host === 'frospon.top' || host.endsWith('.frospon.top')) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
    } catch {
      // URL 解析失败则直接打开
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    setPendingLink({ url, label });
  };

  const confirmExternalLink = () => {
    if (!pendingLink) return;
    window.open(pendingLink.url, '_blank', 'noopener,noreferrer');
    setPendingLink(null);
  };

  const canSave = baseUrl.trim() && apiKey.trim() && model.trim();

  // 当前主题色是否为自定义（不在预设列表中）
  const isCustomColor = !ACCENT_PRESETS.some((p) => p.color.toLowerCase() === accentColor.toLowerCase());

  // Sync form state when apiConfig changes externally
  useEffect(() => {
    if (apiConfig) {
      setBaseUrl(apiConfig.baseUrl);
      setApiKey(apiConfig.apiKey);
      setModel(apiConfig.model);
      setTemperature(apiConfig.temperature);
      setMaxTokens(apiConfig.maxTokens);
    }
  }, [apiConfig]);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    const config: ApiConfig = {
      baseUrl: baseUrl.trim().replace(/\/+$/, ''),
      apiKey: apiKey.trim(),
      model: model.trim(),
      temperature,
      maxTokens,
    };
    const result = await testConnection(config);
    setTestResult(result);
    setIsTesting(false);
  };

  const handleSave = () => {
    const config: ApiConfig = {
      baseUrl: baseUrl.trim().replace(/\/+$/, ''),
      apiKey: apiKey.trim(),
      model: model.trim(),
      temperature,
      maxTokens,
    };
    setApiConfig(config);
    setBalanceWarningThreshold(Math.max(0, Number(warningThreshold) || 0));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // 上传本地图片作为背景（转为 Data URL 存储）
  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAppearance({ backgroundImageUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
    // 重置 input 以便重复选择同一文件
    e.target.value = '';
  };

  // 刷新必应随机壁纸：直接生成新 URL（带 cache-buster）即可换一张
  const handleRefreshBing = () => {
    setBingImageUrl(generateBingImageUrl());
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-black/5 dark:border-white/5 flex-shrink-0">
        <button
          onClick={() => closeSettings(false)}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          title="返回聊天"
        >
          <GameIcon name="arrowLeft" className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold">设置</h1>
      </div>

      {/* Category cards */}
      <div className="flex gap-2.5 px-5 py-3 border-b border-black/5 dark:border-white/5 flex-shrink-0">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-all duration-200
                ${isActive
                  ? 'border-apple-blue/30 bg-apple-blue/8 dark:bg-apple-blue/12 text-apple-blue'
                  : 'border-black/8 dark:border-white/8 hover:border-black/15 dark:hover:border-white/15 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] text-apple-text-secondary'
                }`}
            >
              <GameIcon name={cat.icon} className="w-5 h-5" />
              <span className="text-xs font-medium">{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <CustomScrollbar className="flex-1" viewportClassName="px-5 py-6">
        <div className="max-w-xl mx-auto space-y-8">

          {/* ===== Category: API Config ===== */}
          {activeCategory === 'api' && (
          <section>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-apple-blue" />
              API 配置
            </h2>
            <div className="space-y-4">
              {/* Security warning */}
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <GameIcon name="warning" className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                  API Key 仅保存在本地浏览器，不会上传至任何服务器。建议使用额度较小的 API Key。
                </p>
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-sm font-medium mb-1.5">API 基础 URL</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-4 py-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05]
                    border border-transparent focus:border-apple-blue/30 focus:bg-white dark:focus:bg-white/[0.08]
                    outline-none text-sm transition-all"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium mb-1.5">API Key</label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-4 py-2.5 pr-10 rounded-xl bg-black/[0.03] dark:bg-white/[0.05]
                      border border-transparent focus:border-apple-blue/30 focus:bg-white dark:focus:bg-white/[0.08]
                      outline-none text-sm transition-all"
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-apple-text-secondary
                      hover:text-apple-text transition-colors"
                  >
                    {showKey ? (
                      <GameIcon name="invisible" className="w-4 h-4" />
                    ) : (
                      <GameIcon name="visible" className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Model */}
              <div>
                <label className="block text-sm font-medium mb-1.5">模型名称</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="gpt-4o-mini"
                  className="w-full px-4 py-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05]
                    border border-transparent focus:border-apple-blue/30 focus:bg-white dark:focus:bg-white/[0.08]
                    outline-none text-sm transition-all"
                />
                <p className="text-[11px] text-apple-text-secondary mt-1">
                  支持：gpt-4o-mini、deepseek-chat、gpt-4o 等
                </p>
              </div>

              {/* Temperature */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Temperature: <span className="text-apple-blue font-semibold">{temperature.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none bg-black/10 dark:bg-white/10
                    accent-apple-blue cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-apple-text-secondary mt-1">
                  <span>精确</span>
                  <span>创意</span>
                </div>
              </div>

              {/* Max Tokens */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Max Tokens</label>
                <input
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1024)}
                  min={1}
                  max={8192}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05]
                    border border-transparent focus:border-apple-blue/30 focus:bg-white dark:focus:bg-white/[0.08]
                    outline-none text-sm transition-all"
                />
              </div>

              {/* Balance warning threshold */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  余额预警阈值（元）
                </label>
                <input
                  type="number"
                  value={warningThreshold}
                  onChange={(e) => setWarningThreshold(parseFloat(e.target.value) || 0)}
                  min={0}
                  step="0.01"
                  placeholder="10"
                  className="w-full px-4 py-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05]
                    border border-transparent focus:border-apple-blue/30 focus:bg-white dark:focus:bg-white/[0.08]
                    outline-none text-sm transition-all"
                />
                <p className="text-[11px] text-apple-text-secondary mt-1">
                  余额低于该数值时，侧边栏余额将显示红色呼吸灯提醒
                </p>
              </div>

              {/* Test result */}
              {testResult && (
                <div
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm ${
                    testResult.success
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300'
                  }`}
                >
                  <GameIcon
                    name={testResult.success ? 'tick' : 'cross'}
                    className="w-4 h-4 flex-shrink-0"
                  />
                  {testResult.message}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleTest}
                  disabled={!canSave || isTesting}
                  className="flex-1 py-2.5 rounded-xl border border-black/10 dark:border-white/10
                    text-sm font-medium hover:bg-black/[0.03] dark:hover:bg-white/[0.05]
                    disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {isTesting ? '测试中...' : '测试连接'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={!canSave}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-apple-blue text-white text-sm font-medium
                    disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all"
                >
                  {saved ? (
                    <>
                      <GameIcon name="tick" className="w-4 h-4" />
                      已保存
                    </>
                  ) : (
                    '保存'
                  )}
                </button>
              </div>
            </div>
          </section>
          )}

          {/* ===== Category: Appearance ===== */}
          {activeCategory === 'appearance' && (
          <>
          {/* Section B: Theme Color */}
          <section>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-apple-blue" />
              主题颜色
            </h2>
            <p className="text-xs text-apple-text-secondary mb-4">
              选择你喜欢的主题色，将应用到整个应用界面
            </p>
            <div className="flex gap-4">
              {ACCENT_PRESETS.map((preset) => {
                const isSelected = accentColor === preset.color;
                return (
                  <button
                    key={preset.color}
                    onClick={() => setAccentColor(preset.color)}
                    className="flex flex-col items-center gap-2 group"
                    title={preset.name}
                  >
                    <div
                      className={`w-12 h-12 rounded-full transition-all duration-200 flex items-center justify-center
                        ${isSelected
                          ? 'ring-2 ring-offset-2 dark:ring-offset-apple-dark scale-110'
                          : 'ring-1 ring-black/10 dark:ring-white/10 hover:ring-black/20 dark:hover:ring-white/20 hover:scale-105'
                        }`}
                      style={{
                        backgroundColor: preset.color,
                        ...(isSelected ? { '--tw-ring-color': preset.color } as React.CSSProperties : {}),
                      }}
                    >
                      {isSelected && (
                        <GameIcon name="tick" className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <span
                      className={`text-xs transition-colors ${
                        isSelected
                          ? 'text-apple-text dark:text-white font-medium'
                          : 'text-apple-text-secondary'
                      }`}
                    >
                      {preset.name}
                    </span>
                  </button>
                );
              })}

              {/* 自定义颜色 */}
              <label
                className="flex flex-col items-center gap-2 group cursor-pointer"
                title="自定义颜色"
              >
                <div
                  className={`relative w-12 h-12 rounded-full transition-all duration-200 flex items-center justify-center overflow-hidden
                    ${isCustomColor
                      ? 'ring-2 ring-offset-2 dark:ring-offset-apple-dark scale-110'
                      : 'ring-1 ring-black/10 dark:ring-white/10 hover:ring-black/20 dark:hover:ring-white/20 hover:scale-105'
                    }`}
                  style={{
                    background: isCustomColor
                      ? accentColor
                      : 'conic-gradient(from 0deg, #ff6b8a, #ff9500, #34c759, #007aff, #af52de, #ff6b8a)',
                    ...(isCustomColor
                      ? ({ '--tw-ring-color': accentColor } as React.CSSProperties)
                      : {}),
                  }}
                >
                  {isCustomColor ? (
                    <GameIcon name="tick" className="w-5 h-5 text-white relative z-10" />
                  ) : (
                    <GameIcon name="plus" className="w-4 h-4 text-white drop-shadow relative z-10" />
                  )}
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
                <span
                  className={`text-xs transition-colors ${
                    isCustomColor
                      ? 'text-apple-text dark:text-white font-medium'
                      : 'text-apple-text-secondary'
                  }`}
                >
                  自定义
                </span>
              </label>
            </div>
          </section>

          {/* Divider */}
          <div className="border-t border-black/5 dark:border-white/5" />

          {/* Section B': Appearance Personalization */}
          <section>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-apple-blue" />
              外观个性化
            </h2>
            <p className="text-xs text-apple-text-secondary mb-4">
              微调视觉细节，所有调整立即生效
            </p>
            <div className="space-y-5">
              <SegmentedControl<FontSize>
                label="字体大小"
                value={appearance.fontSize}
                onChange={(v) => setAppearance({ fontSize: v })}
                options={[
                  { value: 'compact', label: '紧凑' },
                  { value: 'standard', label: '标准' },
                  { value: 'comfortable', label: '舒适' },
                ]}
              />

              <SegmentedControl<GlassBlur>
                label="玻璃模糊"
                value={appearance.glassBlur}
                onChange={(v) => setAppearance({ glassBlur: v })}
                options={[
                  { value: 'off', label: '关闭' },
                  { value: 'soft', label: '柔和' },
                  { value: 'standard', label: '标准' },
                  { value: 'strong', label: '强烈' },
                ]}
              />

              <VisualCard<BubbleStyle>
                label="气泡样式"
                value={appearance.bubbleStyle}
                onChange={(v) => setAppearance({ bubbleStyle: v })}
                options={[
                  {
                    value: 'solid',
                    label: '纯色',
                    preview: (
                      <div className="flex items-center justify-center w-full">
                        <div
                          className="w-10 h-8 rounded-md"
                          style={{ backgroundColor: '#007aff', opacity: 0.35 }}
                        />
                      </div>
                    ),
                  },
                  {
                    value: 'glass',
                    label: '毛玻璃',
                    preview: (
                      <div className="flex items-center justify-center w-full">
                        <div
                          className="w-10 h-8 rounded-md"
                          style={{
                            background: 'rgba(255,255,255,0.45)',
                            backdropFilter: 'blur(3px)',
                            border: '1px solid rgba(255,255,255,0.55)',
                          }}
                        />
                      </div>
                    ),
                  },
                  {
                    value: 'liquid',
                    label: '液态玻璃',
                    preview: (
                      <div className="flex items-center justify-center w-full">
                        <div
                          className="w-10 h-8 rounded-md relative overflow-hidden"
                          style={{
                            background: 'linear-gradient(160deg, rgba(0,122,255,0.40), rgba(255,255,255,0.10))',
                            backdropFilter: 'blur(4px) saturate(1.6) contrast(1.15)',
                            border: '1px solid rgba(255,255,255,0.70)',
                            boxShadow:
                              '0 2px 6px rgba(0,0,0,0.10), ' +
                              'inset 0 0 0 0.5px rgba(255,255,255,0.45), ' +
                              'inset 0 0 3px rgba(255,255,255,0.35), ' +
                              'inset 0 0 8px rgba(255,255,255,0.18), ' +
                              'inset 0 1px 0 rgba(255,255,255,0.65)',
                          }}
                        >
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              background:
                                'radial-gradient(90% 60% at 50% 0%, rgba(255,255,255,0.70) 0%, rgba(255,255,255,0.25) 45%, transparent 80%)',
                              mixBlendMode: 'screen',
                            }}
                          />
                        </div>
                      </div>
                    ),
                  },
                ]}
              />

              <VisualCard<BubbleRadius>
                label="气泡圆角"
                value={appearance.bubbleRadius}
                onChange={(v) => setAppearance({ bubbleRadius: v })}
                options={[
                  { value: 'sharp', label: '锐利', preview: <div className="w-8 h-8 bg-apple-blue/30" style={{ borderRadius: 8 }} /> },
                  { value: 'standard', label: '标准', preview: <div className="w-8 h-8 bg-apple-blue/30" style={{ borderRadius: 16 }} /> },
                  { value: 'soft', label: '柔和', preview: <div className="w-8 h-8 bg-apple-blue/30" style={{ borderRadius: 22 }} /> },
                ]}
              />

              <VisualCard<BackgroundDecoration>
                label="背景装饰"
                value={appearance.backgroundDecoration}
                onChange={(v) => setAppearance({ backgroundDecoration: v })}
                options={[
                  { value: 'none', label: '无装饰', preview: <div className="w-12 h-8 rounded-md bg-apple-gray dark:bg-apple-dark border border-black/10 dark:border-white/10" /> },
                  {
                    value: 'dots',
                    label: '点阵',
                    preview: (
                      <div
                        className="w-12 h-8 rounded-md border border-black/10 dark:border-white/10"
                        style={{
                          backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.18) 1px, transparent 1px)',
                          backgroundSize: '8px 8px',
                          backgroundColor: '#f5f5f7',
                        }}
                      />
                    ),
                  },
                  {
                    value: 'grid',
                    label: '网格',
                    preview: (
                      <div
                        className="w-12 h-8 rounded-md border border-black/10 dark:border-white/10"
                        style={{
                          backgroundImage:
                            'linear-gradient(rgba(0,0,0,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.18) 1px, transparent 1px)',
                          backgroundSize: '10px 10px',
                          backgroundColor: '#f5f5f7',
                        }}
                      />
                    ),
                  },
                  {
                    value: 'glow',
                    label: '光晕',
                    preview: (
                      <div
                        className="w-12 h-8 rounded-md border border-black/10 dark:border-white/10"
                        style={{
                          background:
                            'radial-gradient(circle at 20% 30%, rgba(0,122,255,0.55), transparent 60%), radial-gradient(circle at 80% 70%, rgba(0,122,255,0.40), transparent 60%), #f5f5f7',
                        }}
                      />
                    ),
                  },
                ]}
              />

              <VisualCard<BackgroundImage>
                label="背景图片"
                value={appearance.backgroundImage}
                onChange={(v) => setAppearance({ backgroundImage: v })}
                options={[
                  { value: 'solid', label: '纯色', preview: <div className="w-12 h-8 rounded-md bg-apple-gray dark:bg-apple-dark border border-black/10 dark:border-white/10" /> },
                  {
                    value: 'image',
                    label: '图片',
                    preview: (
                      <div
                        className="w-12 h-8 rounded-md border border-black/10 dark:border-white/10 overflow-hidden"
                        style={{
                          background: 'linear-gradient(135deg, #667eea 0%, #f093fb 50%, #4facfe 100%)',
                        }}
                      />
                    ),
                  },
                  {
                    value: 'bing',
                    label: '必应',
                    preview: (
                      <div
                        className="w-12 h-8 rounded-md border border-black/10 dark:border-white/10 overflow-hidden flex items-center justify-center"
                        style={{
                          background: 'linear-gradient(135deg, #00897b 0%, #4facfe 100%)',
                        }}
                      >
                        <span className="text-[8px] font-bold text-white/95">Bing</span>
                      </div>
                    ),
                  },
                ]}
              />

              {/* 图片模式：URL 输入 + 本地上传 */}
              {appearance.backgroundImage === 'image' && (
                <div className="mt-1 space-y-2">
                  <input
                    type="text"
                    value={appearance.backgroundImageUrl.startsWith('data:') ? '' : appearance.backgroundImageUrl}
                    onChange={(e) => setAppearance({ backgroundImageUrl: e.target.value })}
                    placeholder={
                      appearance.backgroundImageUrl.startsWith('data:')
                        ? '✓ 已上传本地图片'
                        : '粘贴图片 URL（https://...）'
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05]
                      border border-transparent focus:border-apple-blue/30 focus:bg-white dark:focus:bg-white/[0.08]
                      outline-none text-sm transition-all"
                  />
                  <div className="flex items-center gap-2">
                    <label className="px-3 py-1.5 rounded-lg text-xs font-medium border border-black/10 dark:border-white/10
                      hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors cursor-pointer inline-flex items-center gap-1.5">
                      <GameIcon name="plus" className="w-3.5 h-3.5" />
                      上传本地图片
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                    {appearance.backgroundImageUrl && (
                      <button
                        onClick={() => setAppearance({ backgroundImageUrl: '' })}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-500
                          hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 必应模式：刷新按钮 */}
              {appearance.backgroundImage === 'bing' && (
                <div className="mt-1 flex items-center gap-3">
                  <p className="text-xs text-apple-text-secondary flex-1">
                    {bingImageUrl ? '已加载必应壁纸，点击刷新换一张' : '点击刷新获取必应壁纸'}
                  </p>
                  <button
                    onClick={handleRefreshBing}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-black/10 dark:border-white/10
                      hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors inline-flex items-center gap-1.5"
                  >
                    <GameIcon name="refresh" className="w-3.5 h-3.5" />
                    刷新
                  </button>
                </div>
              )}

              <SegmentedControl<MotionLevel>
                label="动画强度"
                value={appearance.motionLevel}
                onChange={(v) => setAppearance({ motionLevel: v })}
                options={[
                  { value: 'off', label: '关闭' },
                  { value: 'reduced', label: '减弱' },
                  { value: 'standard', label: '标准' },
                ]}
              />
            </div>
          </section>
          </>
          )}

          {/* ===== Category: Data ===== */}
          {activeCategory === 'data' && (
          <>
          <section>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-apple-blue" />
              导出数据
            </h2>
            <p className="text-xs text-apple-text-secondary mb-4 leading-relaxed">
              将应用数据打包为 JSON 备份文件，可用于跨设备迁移或本地存档。
            </p>

            {/* 安全警告：仅当选中 API 配置时显示 */}
            {exportCategories.has('api') && (
              <div className="flex items-start gap-2.5 px-4 py-3 mb-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <GameIcon name="warning" className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed space-y-1">
                  <p className="font-medium">导出文件将包含 API 密钥</p>
                  <p>
                    为方便快速导入使用，备份文件中的 API Key 以明文形式保存。
                    请妥善保管导出的文件，<span className="font-semibold">不要随意传播或上传到公开场所</span>。
                  </p>
                </div>
              </div>
            )}

            {/* 类别多选 */}
            <div className="space-y-2 mb-4">
              {ALL_CATEGORIES.map((cat) => {
                const checked = exportCategories.has(cat);
                return (
                  <label
                    key={cat}
                    className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all
                      hover:bg-black/[0.02] dark:hover:bg-white/[0.03]
                      border-black/8 dark:border-white/8"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleExportCategory(cat)}
                      className="mt-0.5 w-4 h-4 rounded accent-apple-blue cursor-pointer flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{CATEGORY_LABELS[cat]}</div>
                      <div className="text-[11px] text-apple-text-secondary mt-0.5 leading-relaxed">
                        {CATEGORY_DESCRIPTIONS[cat]}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <button
              onClick={handleExportClick}
              disabled={exportCategories.size === 0}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-apple-blue text-white text-sm font-medium
                disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all"
            >
              <GameIcon name="download" className="w-4 h-4" />
              导出数据
            </button>
          </section>

          {/* Divider */}
          <div className="border-t border-black/5 dark:border-white/5" />

          <section>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-apple-blue" />
              导入数据
            </h2>
            <p className="text-xs text-apple-text-secondary mb-4 leading-relaxed">
              从备份文件恢复数据。<span className="text-amber-600 dark:text-amber-400">导入会覆盖当前对应类别的数据</span>，建议先导出当前数据作为保险。
            </p>

            {importError && (
              <div className="flex items-start gap-2.5 px-4 py-3 mb-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <GameIcon name="warning" className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-800 dark:text-red-200 leading-relaxed">
                  {importError}
                </p>
              </div>
            )}

            <button
              onClick={handleImportClick}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-sm font-medium
                hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-all"
            >
              <GameIcon name="upload" className="w-4 h-4" />
              选择备份文件
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileSelected}
              className="hidden"
            />
          </section>
          </>
          )}

          {/* ===== Category: About ===== */}
          {activeCategory === 'about' && (
          <section>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-apple-blue" />
              关于
            </h2>
            <div className="text-center space-y-2 py-4">
              <div className="flex justify-center mb-2">
                <GameIcon name="message" className="w-12 h-12" />
              </div>
              <h2 className="app-title-gradient text-5xl font-bold leading-tight tracking-tight">
                話窓
              </h2>
              <p className="text-base font-medium text-apple-text-secondary tracking-wide">
                Hanamado
              </p>
              <p className="text-xs text-apple-text-secondary mt-1">v1.0</p>
              <p className="text-sm text-apple-text-secondary leading-relaxed max-w-xs mx-auto mt-2">
                一款日语 AI 对话学习工具
              </p>

              {/* AI 配置状态卡片 */}
              <div className="text-left">
                <AiConfigStatusCard />
              </div>

              <div className="pt-4 text-[11px] text-apple-text-secondary space-y-0.5">
                <p>React + TypeScript + Vite</p>
                <p>Tailwind CSS · Zustand · react-markdown</p>
                <p>部署于 Vercel</p>
              </div>
            </div>

            {/* 词库来源 */}
            <div className="mt-6 p-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <GameIcon name="book" className="w-4 h-4 text-apple-text-secondary" />
                <h3 className="text-sm font-medium">词库来源</h3>
              </div>
              <p className="text-xs text-apple-text-secondary leading-relaxed mb-3">
                JLPT 单词数据整理自开源 Anki 牌组 anki-jlpt-decks（GitHub）。
              </p>
              <button
                onClick={() => handleExternalLink('https://github.com/5mdld/anki-jlpt-decks', 'anki-jlpt-decks 仓库')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-apple-blue text-white text-xs font-medium
                  hover:opacity-90 transition-all"
              >
                <GameIcon name="external" className="w-3.5 h-3.5" />
                访问仓库
              </button>
            </div>

            {/* 图标库 */}
            <div className="mt-3 p-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <GameIcon name="sparkles" className="w-4 h-4 text-apple-text-secondary" />
                <h3 className="text-sm font-medium">图标库</h3>
              </div>
              <p className="text-xs text-apple-text-secondary leading-relaxed mb-3">
                应用内图标素材来自开源图标库 game-icon-pack（GitHub）。
              </p>
              <button
                onClick={() => handleExternalLink('https://github.com/Nieobie/game-icon-pack', 'game-icon-pack 仓库')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-apple-blue text-white text-xs font-medium
                  hover:opacity-90 transition-all"
              >
                <GameIcon name="external" className="w-3.5 h-3.5" />
                访问仓库
              </button>
            </div>

            {/* 友情链接 */}
            <div className="mt-3 p-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <GameIcon name="message" className="w-4 h-4 text-apple-text-secondary" />
                <h3 className="text-sm font-medium">友情链接</h3>
              </div>
              <p className="text-xs text-apple-text-secondary leading-relaxed mb-3">
                作者博客 frospon.top — 个人技术与日常分享。
              </p>
              <button
                onClick={() => handleExternalLink('https://frospon.top', 'frospon.top')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-black/10 dark:border-white/10
                  text-xs font-medium hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-all"
              >
                <GameIcon name="external" className="w-3.5 h-3.5" />
                访问博客
              </button>
            </div>
          </section>
          )}

        </div>
      </CustomScrollbar>

      {/* 外部跳转确认弹窗 */}
      <Modal
        isOpen={pendingLink !== null}
        onClose={() => setPendingLink(null)}
        title="即将离开本站"
        width="max-w-sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <GameIcon name="warning" className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              即将访问的网站并非本网站，请注意安全。请确认您信任该站点后再继续访问。
            </p>
          </div>
          <div className="text-xs text-apple-text-secondary space-y-1.5">
            <p>目标站点：</p>
            <p className="font-mono text-[11px] break-all px-2 py-1.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.06]">
              {pendingLink?.url}
            </p>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setPendingLink(null)}
              className="flex-1 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-sm font-medium
                hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-all"
            >
              取消
            </button>
            <button
              onClick={confirmExternalLink}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-apple-blue text-white text-sm font-medium
                hover:opacity-90 transition-all"
            >
              <GameIcon name="external" className="w-4 h-4" />
              继续访问
            </button>
          </div>
        </div>
      </Modal>

      {/* 导出确认弹窗：包含 API Key 时再次提示安全风险 */}
      <Modal
        isOpen={pendingExport !== null}
        onClose={() => setPendingExport(null)}
        title="安全提示"
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <GameIcon name="warning" className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed space-y-1.5">
              <p className="font-medium">即将导出包含 API 密钥的备份文件</p>
              <p>
                为方便快速导入使用，备份文件中的 API Key 以明文形式保存。任何拿到该文件的人都可以使用你的 API 额度。
              </p>
              <p>
                请妥善保管导出的文件，<span className="font-semibold">不要随意传播或上传到公开场所</span>（如 GitHub、网盘分享、聊天群等）。
              </p>
            </div>
          </div>
          <p className="text-xs text-apple-text-secondary leading-relaxed">
            建议在导入完成后，及时删除存放于本地的备份文件，或定期在 API 服务商后台轮换密钥。
          </p>
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setPendingExport(null)}
              className="flex-1 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-sm font-medium
                hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-all"
            >
              取消
            </button>
            <button
              onClick={confirmExport}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-apple-blue text-white text-sm font-medium
                hover:opacity-90 transition-all"
            >
              <GameIcon name="download" className="w-4 h-4" />
              确认导出
            </button>
          </div>
        </div>
      </Modal>

      {/* 导入预览弹窗：选择要恢复的类别 */}
      <Modal
        isOpen={importPayload !== null}
        onClose={closeImportModal}
        title="导入备份"
        width="max-w-md"
      >
        <div className="space-y-4">
          {importSummary && (
            <>
              {/* 备份文件信息 */}
              <div className="p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-apple-text-secondary">导出时间</span>
                  <span className="font-medium tabular-nums">
                    {importSummary.exportedAt
                      ? formatExportTime(importSummary.exportedAt)
                      : '未知'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-apple-text-secondary">文件大小</span>
                  <span className="font-medium tabular-nums">
                    {formatBytes(importSummary.sizeBytes)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-apple-text-secondary">聊天记录</span>
                  <span className="font-medium tabular-nums">
                    {importSummary.sessionsCount} 条会话
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-apple-text-secondary">AI 收录词库</span>
                  <span className="font-medium tabular-nums">
                    {importSummary.aiVocabCount} 个词条
                  </span>
                </div>
                {importSummary.hasApiConfig && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-apple-text-secondary">API 配置</span>
                    <span className="font-medium text-amber-600 dark:text-amber-400">含 API Key</span>
                  </div>
                )}
              </div>

              {/* 覆盖警告 */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <GameIcon name="warning" className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                  导入将<strong>覆盖</strong>当前所选类别的数据。请确认无需保留现有数据后再继续。
                </p>
              </div>

              {/* 类别多选 */}
              <div>
                <p className="text-xs font-medium mb-2">选择要恢复的类别</p>
                <div className="space-y-2">
                  {importSummary.availableCategories.map((cat) => {
                    const checked = importCategories.has(cat);
                    return (
                      <label
                        key={cat}
                        className="flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-all
                          hover:bg-black/[0.02] dark:hover:bg-white/[0.03]
                          border-black/8 dark:border-white/8"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleImportCategory(cat)}
                          className="mt-0.5 w-4 h-4 rounded accent-apple-blue cursor-pointer flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">{CATEGORY_LABELS[cat]}</div>
                          <div className="text-[11px] text-apple-text-secondary mt-0.5 leading-relaxed">
                            {CATEGORY_DESCRIPTIONS[cat]}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {importError && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <GameIcon name="warning" className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800 dark:text-red-200 leading-relaxed">
                    {importError}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={closeImportModal}
                  disabled={isImporting}
                  className="flex-1 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-sm font-medium
                    hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-all
                    disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  取消
                </button>
                <button
                  onClick={confirmImport}
                  disabled={importCategories.size === 0 || isImporting}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-apple-blue text-white text-sm font-medium
                    hover:opacity-90 transition-all
                    disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <GameIcon name="upload" className="w-4 h-4" />
                  {isImporting ? '正在导入…' : '确认导入'}
                </button>
              </div>
              {isImporting && (
                <p className="text-[11px] text-apple-text-secondary text-center">
                  导入完成后将自动刷新页面以应用更改
                </p>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}