import { useState, useEffect } from 'react';
import type { Role } from '@/types';

interface RoleAvatarProps {
  role: Role;
  /** 头像像素尺寸（正方形）。默认 36 */
  size?: number;
  className?: string;
}

/**
 * 聊天气泡占位图标 —— 与 iconData.ts 中的 'message' 图标保持一致。
 * 内联 SVG 是为了避免 Tailwind JIT 无法识别动态拼接的 w-[Npx] 类名；
 * 同时 GameIcon 当前不支持 style 透传，直接内联可精确控制像素尺寸。
 */
function BubblePlaceholder({ size }: { size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      viewBox="2 2 6 6"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <path d="M5 2.504c1.657 0 3 .985 3 2.2s-1.343 2.2-3 2.2c-.3 0-.59-.035-.862-.096a.42.42 0 0 0-.325.056l-.146.096c-.63.411-.946.618-1.155.507a.4.4 0 0 1-.078-.055c-.177-.158-.092-.525.078-1.26a.37.37 0 0 0-.082-.317C2.158 5.505 2 5.118 2 4.704c0-1.215 1.343-2.2 3-2.2M3.95 5.097a.45.45 0 0 0 0 .9h1.3a.45.45 0 0 0 0-.9zm0-1.6a.45.45 0 0 0 0 .901h2.1a.45.45 0 0 0 0-.9z" />
    </svg>
  );
}

/**
 * 角色头像：圆角矩形。
 * - 有 avatar 图片时显示图片（object-cover 自动裁剪填充）。
 * - 无图片或加载失败时显示聊天气泡占位（浅蓝底 + 蓝色气泡图标）。
 */
export default function RoleAvatar({ role, size = 36, className = '' }: RoleAvatarProps) {
  const [imgError, setImgError] = useState(false);

  // 角色切换时重置错误状态，重新尝试加载新头像
  useEffect(() => {
    setImgError(false);
  }, [role.avatar, role.id]);

  // 圆角半径 ~28%，呈现圆角矩形而非正圆
  const radius = Math.round(size * 0.28);
  // 占位图标尺寸 ~55%，留出边距
  const iconSize = Math.max(10, Math.round(size * 0.55));

  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
  };

  if (!role.avatar || imgError) {
    return (
      <div
        className={`flex items-center justify-center bg-apple-blue/10 text-apple-blue flex-shrink-0 ${className}`}
        style={containerStyle}
        role="img"
        aria-label={role.name}
      >
        <BubblePlaceholder size={iconSize} />
      </div>
    );
  }

  return (
    <img
      src={role.avatar}
      alt={role.name}
      onError={() => setImgError(true)}
      className={`object-cover flex-shrink-0 ${className}`}
      style={containerStyle}
    />
  );
}
