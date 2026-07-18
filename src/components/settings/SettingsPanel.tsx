import { useState, useEffect, type ReactNode, type ChangeEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import GameIcon from '@/components/common/GameIcon';
import CustomScrollbar from '@/components/common/CustomScrollbar';
import type { IconName } from '@/components/icons/iconData';
import { useChatStore } from '@/store/chatStore';
import { testConnection } from '@/services/ai';
import { fetchBingImageUrl } from '@/services/bing';
import type {
  ApiConfig,
  FontSize,
  GlassBlur,
  BubbleRadius,
  BackgroundPattern,
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

type SettingsCategory = 'api' | 'appearance' | 'about';

const CATEGORIES: { id: SettingsCategory; label: string; icon: IconName }[] = [
  { id: 'api', label: 'API 配置', icon: 'settings' },
  { id: 'appearance', label: '外观', icon: 'sparkles' },
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
  const accentColor = useChatStore((s) => s.accentColor);
  const setAccentColor = useChatStore((s) => s.setAccentColor);
  const appearance = useChatStore(
    useShallow((s) => ({
      fontSize: s.fontSize,
      glassBlur: s.glassBlur,
      bubbleRadius: s.bubbleRadius,
      backgroundPattern: s.backgroundPattern,
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
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('api');
  const [isBingRefreshing, setIsBingRefreshing] = useState(false);

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

  // 刷新必应随机壁纸
  const handleRefreshBing = async () => {
    setIsBingRefreshing(true);
    try {
      const url = await fetchBingImageUrl();
      setBingImageUrl(url);
    } catch (err) {
      console.error('[Hanamado] 必应壁纸刷新失败:', err);
    } finally {
      setIsBingRefreshing(false);
    }
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

              <VisualCard<BackgroundPattern>
                label="背景装饰"
                value={appearance.backgroundPattern}
                onChange={(v) => setAppearance({ backgroundPattern: v })}
                options={[
                  { value: 'solid', label: '纯色', preview: <div className="w-12 h-8 rounded-md bg-apple-gray dark:bg-apple-dark border border-black/10 dark:border-white/10" /> },
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
              {appearance.backgroundPattern === 'image' && (
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
              {appearance.backgroundPattern === 'bing' && (
                <div className="mt-1 flex items-center gap-3">
                  <p className="text-xs text-apple-text-secondary flex-1">
                    {bingImageUrl ? '已加载必应壁纸，点击刷新换一张' : '正在获取必应壁纸…'}
                  </p>
                  <button
                    onClick={handleRefreshBing}
                    disabled={isBingRefreshing}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-black/10 dark:border-white/10
                      hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors inline-flex items-center gap-1.5
                      disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <GameIcon name="refresh" className={`w-3.5 h-3.5 ${isBingRefreshing ? 'animate-spin' : ''}`} />
                    {isBingRefreshing ? '刷新中' : '刷新'}
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

          {/* ===== Category: About ===== */}
          {activeCategory === 'about' && (
          <section>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-apple-blue" />
              关于
            </h2>
            <div className="text-center space-y-3 py-4">
              <div className="flex justify-center">
                <GameIcon name="message" className="w-12 h-12" />
              </div>
              <h2 className="text-2xl font-semibold">話窓 Hanamado</h2>
              <p className="text-sm text-apple-text-secondary">v1.0</p>
              <p className="text-sm text-apple-text-secondary leading-relaxed max-w-xs mx-auto">
                一款日语 AI 对话学习工具，通过 AI 角色对话提升日语能力。
                支持自动分词、点击查词、语法查询等功能。
              </p>
              <div className="pt-3 text-[11px] text-apple-text-secondary space-y-0.5">
                <p>React + TypeScript + Vite</p>
                <p>Tailwind CSS · Zustand · react-markdown</p>
                <p>部署于 Vercel</p>
              </div>
            </div>
          </section>
          )}

        </div>
      </CustomScrollbar>
    </div>
  );
}