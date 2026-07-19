import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useChatStore } from '@/store/chatStore';
import { generateBingImageUrl } from '@/services/bing';
import type {
  FontSize,
  GlassBlur,
  BubbleRadius,
  BackgroundDecoration,
  BackgroundImage,
  MotionLevel,
  BubbleStyle,
} from '@/types';

interface ThemeContextValue {
  theme: string;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
});

/* 外观设置 → CSS 变量/类名 映射常量 */
const FONT_SCALE: Record<FontSize, number> = {
  compact: 0.92,
  standard: 1,
  comfortable: 1.1,
};

const GLASS_BLUR_PX: Record<GlassBlur, number> = {
  off: 0,
  soft: 10,
  standard: 20,
  strong: 32,
};

const BUBBLE_RADIUS_PX: Record<BubbleRadius, number> = {
  sharp: 8,
  standard: 16,
  soft: 22,
};

/** 装饰层类名（none 不添加任何类） */
const DECORATION_CLASS: Record<BackgroundDecoration, string> = {
  none: '',
  dots: 'bg-decoration-dots',
  grid: 'bg-decoration-grid',
  glow: 'bg-decoration-glow',
};

const MOTION_CLASS: Record<MotionLevel, string> = {
  off: 'motion-off-app',
  reduced: 'motion-reduced-app',
  standard: '',
};

const BUBBLE_STYLE_CLASS: Record<BubbleStyle, string> = {
  solid: 'bubble-style-solid',
  glass: 'bubble-style-glass',
  liquid: 'bubble-style-liquid',
};

const ALL_DECORATION_CLASSES = ['bg-decoration-dots', 'bg-decoration-grid', 'bg-decoration-glow'];
const ALL_MOTION_CLASSES = ['motion-off-app', 'motion-reduced-app'];
const ALL_BUBBLE_STYLE_CLASSES = ['bubble-style-solid', 'bubble-style-glass', 'bubble-style-liquid'];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useChatStore((s) => s.theme);
  const toggleTheme = useChatStore((s) => s.toggleTheme);
  const accentColor = useChatStore((s) => s.accentColor);

  // 外观设置：用 useShallow 浅比较，避免返回新对象导致无限重渲染
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
  const bingImageUrl = useChatStore((s) => s.bingImageUrl);
  const setBingImageUrl = useChatStore((s) => s.setBingImageUrl);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const hex = accentColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const root = document.documentElement;
    root.style.setProperty('--accent-r', String(r));
    root.style.setProperty('--accent-g', String(g));
    root.style.setProperty('--accent-b', String(b));
  }, [accentColor]);

  // 外观个性化：量化参数 → CSS 变量；离散枚举 → documentElement 类名
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--font-scale', String(FONT_SCALE[appearance.fontSize]));
    root.style.setProperty('--glass-blur', `${GLASS_BLUR_PX[appearance.glassBlur]}px`);
    root.style.setProperty('--bubble-radius', `${BUBBLE_RADIUS_PX[appearance.bubbleRadius]}px`);

    // 移除旧值，再按当前值添加
    root.classList.remove(
      ...ALL_DECORATION_CLASSES,
      ...ALL_MOTION_CLASSES,
      ...ALL_BUBBLE_STYLE_CLASSES
    );
    const decorationCls = DECORATION_CLASS[appearance.backgroundDecoration];
    if (decorationCls) root.classList.add(decorationCls);
    const motionCls = MOTION_CLASS[appearance.motionLevel];
    if (motionCls) root.classList.add(motionCls);
    root.classList.add(BUBBLE_STYLE_CLASS[appearance.bubbleStyle]);
  }, [
    appearance.fontSize,
    appearance.glassBlur,
    appearance.bubbleRadius,
    appearance.backgroundDecoration,
    appearance.motionLevel,
    appearance.bubbleStyle,
  ]);

  // 背景图片：根据 backgroundImage 设置 --bg-image 变量与 has-bg-image 类名
  // 'image' → 使用用户自定义 URL；'bing' → 使用缓存的必应 URL（无缓存时自动生成）
  useEffect(() => {
    const root = document.documentElement;
    const mode = appearance.backgroundImage;

    let imageUrl = '';
    if (mode === 'image') {
      imageUrl = appearance.backgroundImageUrl;
    } else if (mode === 'bing') {
      imageUrl = bingImageUrl;
    }

    if (imageUrl) {
      root.style.setProperty('--bg-image', `url("${imageUrl}")`);
      root.classList.add('has-bg-image');
    } else {
      root.style.setProperty('--bg-image', 'none');
      root.classList.remove('has-bg-image');
    }

    // 必应模式且无缓存时，自动生成一张随机壁纸 URL
    if (mode === 'bing' && !bingImageUrl) {
      setBingImageUrl(generateBingImageUrl());
    }
  }, [appearance.backgroundImage, appearance.backgroundImageUrl, bingImageUrl, setBingImageUrl]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
