# 液态玻璃效果入门教程

> 基于 [shuding/liquid-glass](https://github.com/shuding/liquid-glass) 仓库，并融合 [outpace studios](https://glass.outpacestudios.com/) 的工程方案，从零理解原理，并做出一个**会跟随鼠标、跨浏览器工作的液态玻璃卡片**。
> 配套示例文件：[`liquid-glass-demo.html`](./liquid-glass-demo.html)（双击即可在浏览器打开运行）。

> **阅读路线**：第三~五节先讲"简化原理版"（好懂，但有跨浏览器局限）；第六节讲 demo 实际用的"outpace 工程升级版"（真实物理折射 + 跨浏览器架构）。初学者建议按顺序读——先理解简化版为什么"够用但不完美"，再理解升级版解决什么问题。

---

## 零、最终效果

打开 `liquid-glass-demo.html`，你会看到：

- 一张**每日 Bing 美图**作为全屏背景（通过 Bing 官方 API 自动获取当日图片，4K 分辨率），上面叠加一个**带液体玻璃效果的大字 "GLASS"**（自带模糊/折射滤镜，像透过毛玻璃看字）。
- 一块**暗色胶囊形玻璃卡片**，会**顺滑地跟随着你的鼠标**移动。卡片内部比外部略暗，白色文字在暗底上清晰可读。
- 透过卡片看到的 Bing 照片和 "GLASS" 字被**放大、折射**了——真实照片的高频细节（纹理、边缘、色彩变化）比纯色块更能体现折射效果，就像真的透过一块厚玻璃看世界。
- 卡片边缘有一圈**克制的银灰高光**和底部暗角，暗色主题下立体感更强。
- 在 Chrome / Safari / Firefox 三个浏览器里**效果一致**（不会在 Safari 退化为模糊磨砂板）。

本教程会带你一步步把它做出来，并且**每一步都讲清楚为什么**。

---

## 一、液体玻璃效果到底是什么？

想象你把一块厚玻璃（比如放大镜、玻璃砖）贴在屏幕上。你会看到三种现象：

| 现象 | 说明 | 在网页里由谁负责 |
|------|------|------------------|
| **看穿** | 能看到玻璃后面的东西 | `backdrop-filter` |
| **折射 / 放大** | 后面的东西被扭曲、放大 | SVG 滤镜 `feDisplacementMap` |
| **边缘高光** | 玻璃边缘有亮边、阴影 | `box-shadow` |

所以做液态玻璃，本质上就是**把这三件事拼起来**。下面先讲清楚最关键、也最抽象的一步：**折射是怎么做出来的**。

---

## 二、核心原理：位移贴图（Displacement Map）

### 2.1 一句话理解

> 给图片里**每一个像素**，指定一个"它应该从别处哪里搬过来"，整张图就被扭曲了。

举例：如果屏幕上某点 `A`，本来显示的是它正下方的背景；现在我们告诉浏览器"不，你从 `A` 右边 10px 的地方取样来显示"，于是 `A` 处看到的内容就向左偏了。**所有像素都这么做，且偏移量随位置平滑变化，就形成了折射。**

### 2.2 用一张图来记录"每个像素搬多少"

不可能对每个像素单独写代码，所以我们**画一张图**，用颜色来记录偏移量：

- **R（红）通道** → 水平偏移量
- **G（绿）通道** → 垂直偏移量
- 颜色值 `128`（中性灰）→ 表示"不偏移"
- 比 128 大 → 往一个方向偏；比 128 小 → 往反方向偏

这张图就叫**位移贴图（Displacement Map）**。

### 2.3 SVG 滤镜 `feDisplacementMap`：负责"搬"

SVG 提供了一个原生的滤镜 `feDisplacementMap`，它的工作就是：

```
新位置 = 原位置 + (通道值 - 0.5) × scale
```

- `通道值` 在 `0~1` 之间（即 `颜色值 / 255`）。
- `scale` 是一个**强度系数**，越大折射越夸张。
- 我们要做的，就是**生成那张位移贴图**，并喂给这个滤镜。

### 2.4 `backdrop-filter`：让滤镜作用在"背景"上

普通 SVG 滤镜作用在元素自己身上。而玻璃要扭曲的是**它后面的背景**。
`backdrop-filter` 让我们能对"元素背后的内容"应用滤镜，于是 `backdrop-filter: url(#我们的滤镜)` 就让背景被折射了。

> ⚠️ **注意**：`backdrop-filter` 配合 SVG 滤镜**只在 Chromium 浏览器生效**。Safari 和 Firefox 会静默丢弃 SVG 部分，只留模糊效果。这是网上一大半"液态玻璃"教程在 Safari 里塌成磨砂板的根本原因。实际 demo 改用 **filtered background copy** 架构（见第六节），把所有浏览器都救回来。

### 2.5 整体流程图

简化版（第三~五节，仅教学用）：

```
                  Canvas 算出每个像素该搬多少
                           │
                           ▼
                    生成一张位移贴图（PNG）
                           │
                           ▼  作为 feImage 的输入
              ┌──────────────────────────┐
              │  SVG 滤镜 feDisplacementMap │  ← scale 控制强度
              └──────────────────────────┘
                           │
                           ▼
            backdrop-filter: url(#滤镜)  应用到卡片
                           │
                           ▼
                  背景被折射 → 液态玻璃 ✓
```

升级版（demo 实际使用，第六节详解）：

```
  Bing API → 每日 4K 照片 → 设为背景图
                │
                ▼
         克隆背景到卡片内部（副本）
                │
                ▼
      副本用普通 filter: url(#滤镜) 折射  ← 跨浏览器！
                │
                ▼
     lens box (overflow:hidden) 裁剪 → 液态玻璃 ✓
```

整张图里**最关键、最需要理解的就是 2.1 那句话**。如果看懂了，后面的代码只是把它落实。

---

## 三、动手实现（分 7 步）

### 第 1 步：HTML 骨架

先搭好结构：背景光斑、SVG 滤镜、玻璃卡片。

```html
<body>
  <!-- 彩色背景 -->
  <div class="blob b1"></div>
  <div class="blob b2"></div>
  ...

  <!-- SVG 滤镜定义（不占布局） -->
  <svg class="svg-defs" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="glass-filter" filterUnits="userSpaceOnUse"
              color-interpolation-filters="sRGB"
              x="0" y="0" width="320" height="200">
        <feImage id="glass-map" x="0" y="0" width="320" height="200"
                 preserveAspectRatio="none" href="" />
        <feDisplacementMap in="SourceGraphic" in2="glass-map"
                           scale="0" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>
  </svg>

  <!-- 玻璃卡片 -->
  <div class="glass-card" id="glassCard">
    <div class="label">...</div>
  </div>
</body>
```

几个要点：

- `filterUnits="userSpaceOnUse"`：让滤镜区域用**像素坐标**，方便和 Canvas 对齐。
- `color-interpolation-filters="sRGB"`：**很重要**。不加的话颜色会按线性 RGB 插值，导致折射颜色发暗发灰。这是新手最容易踩的坑之一。
- `feImage` 负责把我们的位移贴图作为输入；`feDisplacementMap` 负责搬像素，`xChannelSelector="R"` 表示用 R 通道做水平偏移，`yChannelSelector="G"` 表示用 G 通道做垂直偏移。
- `scale="0"` 先占位，待会儿用 JS 算出正确值再填。

### 第 2 步：彩色背景（让折射看得见）

折射是"扭曲背景"，所以**背景越花，效果越明显**。简化版教程用几个模糊的彩色圆斑 + 一个超大字来演示：

```css
body { background: #0b0d1a; }

.blob {
  position: fixed; border-radius: 50%;
  filter: blur(60px); opacity: 0.85;
  pointer-events: none;
}
.blob.b1 { width: 480px; height: 480px; left: 8%; top: 12%; background: #ff5e8a; animation: float1 14s ease-in-out infinite; }
/* ...更多光斑... */

@keyframes float1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(80px,60px) scale(1.15)} }

.stage-text {  /* 背景大字 */
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.10);
  font-size: 22vw; font-weight: 900;
}
```

> 小贴士：彩色 + 高对比边缘 + 运动，是让折射"显形"的三件套。如果你做完发现玻璃看不出效果，多半是背景太素了。

> **实际 demo 的背景**：demo 文件用的是**每日 Bing 美图**（通过 `https://www.bing.com/HPImageArchive.aspx` API 获取当日 4K 照片，设为 `background-image: cover`）。真实照片的高频细节（纹理、边缘、色彩过渡）比纯色块更能体现折射效果，而且每天自动换图，永远不会腻。获取方式见 demo 源码第 4 节 `fetchBingImage()` 函数。

### 第 3 步：玻璃卡片容器

```css
.glass-card {
  position: fixed;
  width: 320px; height: 200px;
  border-radius: 100px;            /* 胶囊形 */
  overflow: hidden;
  /* 核心：SVG 滤镜做折射 + 微调让玻璃更通透 */
  backdrop-filter: url(#glass-filter) blur(0.3px) contrast(1.15) brightness(1.06) saturate(1.15);
  /* 边缘高光 */
  box-shadow:
    0 10px 40px rgba(0,0,0,0.45),
    inset 0 1px 0 rgba(255,255,255,0.55),    /* 顶部细高光 */
    inset 0 -10px 20px rgba(255,255,255,0.10);
  pointer-events: none;
}
```

`backdrop-filter` 里除了 `url(#glass-filter)`，还串了几个小滤镜，它们各自的作用：

- `blur(0.3px)`：极轻微的模糊，模拟玻璃非完美光滑。
- `contrast(1.15)`：让透过来的颜色更"精神"。
- `brightness(1.06)`：微微提亮，玻璃看起来更通透。
- `saturate(1.15)`：稍微加饱和，避免折射后颜色发灰。

这些数值都很小，是"调味"用的，可按喜好调。

### 第 4 步：理解 SVG 滤镜（回顾）

到这一步，HTML 和 CSS 都写好了，但 `scale="0"` 还没填，`feImage` 的 `href` 还是空的。**卡片此时不会折射**，因为我们还没喂贴图给它。下一步就来生成贴图。

### 第 5 步：用 Canvas 生成位移贴图

这是**最核心**的一段代码。我们逐像素地计算"每个点应该从哪里取样"，然后偏移量编码成颜色。

先准备两个小工具函数：

```js
// 平滑插值：把 t 从 [a,b] 平滑映射到 [0,1]
function smoothStep(a, b, t) {
  t = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function length(x, y) { return Math.sqrt(x * x + y * y); }

// 圆角矩形 SDF（下一节解释）
function roundedRectSDF(x, y, halfW, halfH, radius) {
  const qx = Math.abs(x) - halfW + radius;
  const qy = Math.abs(y) - halfH + radius;
  return Math.min(Math.max(qx, qy), 0) + length(Math.max(qx, 0), Math.max(qy, 0)) - radius;
}
```

然后是生成贴图的主体：

```js
function buildDisplacementMap(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const total = width * height;
  const dxArr = new Float32Array(total);
  const dyArr = new Float32Array(total);
  let maxAbs = 0;

  // ① 逐像素计算偏移量
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const uvx = x / width - 0.5;     // 归一化 + 居中到 [-0.5, 0.5]
      const uvy = y / height - 0.5;

      // 到透镜边缘的距离（下一节解释）
      const distanceToEdge = roundedRectSDF(uvx, uvy, 0.3, 0.2, 0.6);
      // 折射权重：内部 = 1，越往外越快衰减到 0
      const displacement = smoothStep(0.8, 0, distanceToEdge - 0.15);
      const scaled = smoothStep(0, 1, displacement);

      // ② 目标采样位置：把当前点向中心拉近 → 放大/折射
      const targetU = uvx * scaled + 0.5;
      const targetV = uvy * scaled + 0.5;

      // ③ 偏移量 = 目标位置 - 当前位置（像素单位）
      const dx = (targetU - (uvx + 0.5)) * width;
      const dy = (targetV - (uvy + 0.5)) * height;

      dxArr[i] = dx;  dyArr[i] = dy;
      if (Math.abs(dx) > maxAbs) maxAbs = Math.abs(dx);
      if (Math.abs(dy) > maxAbs) maxAbs = Math.abs(dy);
    }
  }

  // ④ 把偏移量编码成颜色
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;
  for (let i = 0; i < total; i++) {
    const r = dxArr[i] / maxAbs + 0.5;   // 0~1，128=不偏移
    const g = dyArr[i] / maxAbs + 0.5;
    data[i*4]   = Math.max(0, Math.min(255, r * 255));
    data[i*4+1] = Math.max(0, Math.min(255, g * 255));
    data[i*4+2] = 0;
    data[i*4+3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  // scale = maxAbs，保证 (通道-0.5) × scale 正好还原原始偏移
  return { canvas, scale: maxAbs };
}
```

**关键理解**：`scaled` 这个值在玻璃内部接近 1，把当前点 `uvx` 乘以它再回到中心 `+0.5`，相当于"几乎不变"；而在边缘 `scaled` 趋近 0，目标位置被拉向中心 `(0.5, 0.5)`。**于是边缘的像素都去采样中心的内容 → 看起来像被放大、被吸进去 → 折射感**。

### 第 6 步：理解 SDF（有符号距离场）

第 5 步里那个 `roundedRectSDF` 看着很玄乎，其实只做一件事：

> 返回某个点**到圆角矩形边缘的距离**，并且带符号——点在矩形**内部**返回**负数**，在外部返回**正数**，恰好在边缘返回 0。

为什么需要它？因为我们希望：

- 玻璃**中心**折射强 → 权重接近 1
- 玻璃**边缘**折射弱 → 权重接近 0
- 过渡要**平滑**

有了 SDF，我们就有一个"到边缘的距离"，再用 `smoothStep` 把它平滑地映射成 0~1 的权重，完美满足上面三条。

`roundedRectSDF(uvx, uvy, 0.3, 0.2, 0.6)` 的三个数：

- `0.3, 0.2`：圆角矩形的"半宽、半高"（归一化坐标，所以是 0~0.5）。
- `0.6`：圆角半径。这里半径 > 半宽半高，所以矩形两头被完全磨圆 → 形成一个**胶囊形透镜**。

> 不用死记公式。把它当成"给我一个形状，我就能知道任意点到它边缘的距离"的工具即可。

### 第 7 步：把贴图塞进滤镜 + 卡片跟随鼠标

贴图生成好之后，把它喂给 `feImage`，并设置 `scale`：

```js
function applyDisplacementMap(width, height) {
  const { canvas, scale } = buildDisplacementMap(width, height);
  const feImage = document.getElementById('glass-map');
  const feDisp  = document.querySelector('#glass-filter feDisplacementMap');

  const url = canvas.toDataURL();
  feImage.setAttribute('href', url);                                   // 现代浏览器
  feImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', url); // 兼容老浏览器
  feDisp.setAttribute('scale', scale.toString());
}
```

最后让卡片**平滑跟随鼠标**——用"每帧追近 12%"的缓动，产生顺滑的滞后感：

```js
const card = document.getElementById('glassCard');
const CARD_W = 320, CARD_H = 200;

let targetX = window.innerWidth/2 - CARD_W/2;
let targetY = window.innerHeight/2 - CARD_H/2;
let curX = targetX, curY = targetY;

window.addEventListener('mousemove', (e) => {
  targetX = e.clientX - CARD_W / 2;   // 卡片中心对准鼠标
  targetY = e.clientY - CARD_H / 2;
});

function loop() {
  curX += (targetX - curX) * 0.12;    // 缓动系数 0.12，越大跟得越紧
  curY += (targetY - curY) * 0.12;
  card.style.transform = `translate(${curX}px, ${curY}px)`;
  requestAnimationFrame(loop);
}
loop();

applyDisplacementMap(CARD_W, CARD_H);   // 启动
```

> `0.12` 这个数叫**缓动系数**：越大跟得越紧、越"硬"；越小越"软"、拖尾越长。试试 `0.05` 和 `0.3`，感受区别。

---

## 四、关键参数怎么调

打开 demo 后，可以试着改这些参数感受效果变化：

| 参数 | 在哪里 | 作用 | 调大 / 调小 |
|------|--------|------|-------------|
| `scale` | JS 计算后写入滤镜 | 折射强度 | 大→扭曲夸张；小→接近普通玻璃 |
| `0.3, 0.2, 0.6` | `roundedRectSDF` 参数 | 透镜的形状和大小 | 改前两个数改变透镜覆盖范围；改第三个数改变圆角 |
| `0.8, 0` | `smoothStep(0.8, 0, ...)` | 折射衰减区间 | 控制边缘折射从强到弱的过渡范围 |
| `0.15` | `distanceToEdge - 0.15` | 折射"开始衰减"的位置 | 大→衰减区更靠内；小→更靠外 |
| `0.12` | 跟随缓动系数 | 鼠标跟随手感 | 大→跟得紧；小→拖尾长 |
| `contrast / brightness / saturate` | CSS `backdrop-filter` | 玻璃通透感 | 微调"调味" |

> 一个常见误区：觉得"折射不够强"就去加大 `scale`。但 `scale` 是由 `maxAbs` 算出来的，直接改它确实会增强，但更好的做法是改透镜函数里的 `scaled`（比如把 `scaled` 整体放大），这样形状自然、不会失真。

---

## 五、常见问题（新手必看）

**Q1：我的玻璃完全没有折射效果？**
检查三件事：① `feImage` 的 `href` 是否真的被 JS 填上了（F12 检查元素）；② `feDisplacementMap` 的 `scale` 是不是还是 `0`；③ `backdrop-filter` 里 `url(#glass-filter)` 的 id 是否和 `<filter id="...">` 一致。

**Q2：颜色发暗、发灰，像蒙了一层雾？**
99% 是忘了 `color-interpolation-filters="sRGB"`。加上即可。

**Q3：背景没有显示 Bing 图片，是黑色的？**
- 如果你是通过双击 HTML 文件打开（地址栏是 `file://`），浏览器会禁止页面 `fetch()` Bing 的 API。demo 会自动使用一张默认 Bing 图片兜底，所以不会全黑；**但要看每日最新图，请通过本地 HTTP 服务器打开**：`npx serve .` 或 `python -m http.server 8080`，然后访问 `http://localhost:8080/liquid-glass-demo.html`。
- 检查网络是否能访问 `https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1`。可以在控制台看 `[Bing]` 前缀的日志。

**Q4：在 Firefox 下不工作 / 折射错位？**
- `feImage` 引用 `data:` URI 在部分浏览器有渲染问题，生产环境建议改用 `blob:` URL（见下一节）。
- `backdrop-filter` 在 Firefox 早期版本需加 `-webkit-` 前缀或开启 flag，新版已默认支持。

**Q5：卡片不动 / 不跟随鼠标？**
打开浏览器控制台看有没有报错。最常见是 `getElementById` 拿不到元素——确保 `<script>` 在 DOM 之后（放在 `</body>` 前即可）。

**Q6：性能卡顿？**
位移贴图**只在启动时生成一次**（本 demo 就是这么做的），不需要每帧重算。如果你做了交互式折射（贴图随鼠标变化），记得节流或降低分辨率。

---

## 六、outpace studios 工程升级版

> 这一节讲解 demo 文件**实际采用**的方案，参考 [outpace studios 的文章](https://glass.outpacestudios.com/)。
> 如果说第三~五节是"画出像玻璃的东西"，这一节是"做出真的是玻璃的东西"。

### 6.0 为什么简化版不够用？

简化版（第三~五节）能跑、能看出折射，但有**三个硬伤**：

| 问题 | 简化版的做法 | 后果 |
|------|-------------|------|
| **折射是"画"出来的** | `smoothStep` 衰减权重 | 看着像玻璃，但形状不对——边缘折射该多强、中心该多弱，全是手调的，不是物理算出来的 |
| **跨浏览器塌陷** | `backdrop-filter: url(#filter)` | 只有 Chromium 真的折射；Safari / Firefox **静默丢弃 SVG 部分**，只剩模糊 → 你以为做了玻璃，其实别的浏览器看到的是磨砂板 |
| **贴图送不到滤镜** | `feImage` 用 `data:` URI | WebKit 在 `feImage` 里**静默拒绝加载** `data:` URI → 贴图永远到不了 → 玻璃塌成平面，连 Chrome 都可能出问题 |

outpace 的方案就是逐一解决这三点。下面分五步讲。

---

### 6.1 升级一：用 Snell 定律算真实折射

**简化版的折射权重是"手调"的**：`smoothStep(0.8, 0, ...)` 决定哪里折射强、哪里弱，但这个曲线跟真实玻璃没关系，只是"看着像"。

outpace 的做法是**把透镜当真实物体建模，用光学算折射**：

#### 第 1 步：建模透镜形状

把玻璃想象成一个**凸的 squircle 圆顶**——中心平坦，往边缘逐渐陡下去（就像一片放大镜的截面）。Apple 用 squircle（超椭圆）做圆角，outpace 也用它做透镜边缘。

#### 第 2 步：每个像素算表面斜率

对贴图上每个像素，问一个问题：**这块玻璃在这里的表面有多陡？**

```
x = 从边缘往内的深度（0 = 边缘, 1 = 进入平坦中心区）
slope = (1 - x)³ / (1 - (1 - x)⁴)^0.75
```

- `x = 1`（中心）→ `slope = 0`（中心是平的）
- `x = 0`（边缘）→ `slope → ∞`（边缘几乎垂直）

这个公式看着复杂，但它就是个**连续平滑过渡**：从中心的 0 平滑增长到边缘的无穷大。**没有突变**——这一点很重要，它解决了纯 Snell 曲线在边缘的突变问题。

#### 第 3 步：用 Snell 定律算折射角

光从空气进玻璃会弯。Snell 定律告诉我们弯多少：

```
θ_i = atan(slope)                    // 入射角 = 表面斜率的反正切
θ_t = asin(sin(θ_i) / n)             // 折射角，n = 玻璃折射率 = 1.5
bend = sin(θ_i - θ_t)                // 折射强度（0 中心，最大边缘）
```

`n = 1.5` 是真实玻璃的折射率（不是瞎填的数）。这就完成了"从物理算折射"。

#### 第 4 步：决定折射方向

光被折射后朝哪边偏？沿**表面法线**方向。法线就是 SDF 的梯度（变化最快的方向），对每个像素算 SDF 在 x 和 y 方向的偏导数即为法线：

```js
// 用数值差分算 SDF 梯度（精确法线，而非中心径向近似）
const eps = 0.005;
const dx = roundedRectSDF(uvx + eps, uvy, 0.3, 0.2, 0.6)
         - roundedRectSDF(uvx - eps, uvy, 0.3, 0.2, 0.6);
const dy = roundedRectSDF(uvx, uvy + eps, 0.3, 0.2, 0.6)
         - roundedRectSDF(uvx, uvy - eps, 0.3, 0.2, 0.6);
const len = length(dx, dy) || 1e-6;
const nx = dx / len;   // 精确法线 x 分量
const ny = dy / len;   // 精确法线 y 分量
```

> **为什么不能用"从中心指向当前点"近似？** 胶囊形的上下边缘是平的——在底部边缘，法线应该**几乎垂直向下**（`nx ≈ 0, ny ≈ +1`），而"中心方向近似"会给出一个**对角线方向**（因为中心在偏上方），导致底部折射出现错误的横向偏移。**数值梯度**直接算 SDF 的实际变化方向，无论形状多复杂都能得到正确法线。这是修复卡片下边缘折射异常的关键。**outpace 原文说"reading the surface normal off a signed-distance field"——正是这个意思。**

#### 第 5 步：写进贴图

把"沿法线方向、强度为 bend"的偏移编码进 R/G 通道：

```js
const r = 128 + nx * bend * GAIN;   // 128 = 不偏移
const g = 128 + ny * bend * GAIN;
```

> **关键差异**：简化版是"按权重把采样点拉向中心"，权重靠 `smoothStep` 手调；升级版是"按真实光学算每个像素该偏多少"，偏移量来自物理。前者是"画"，后者是"算"。

**对应到 demo 代码**：见 [`liquid-glass-demo.html`](./liquid-glass-demo.html) 第 2 节 `buildDisplacementMap` 函数。三个核心常量：

| 常量 | 含义 | 调大会怎样 |
|------|------|-----------|
| `IOR = 1.5` | 玻璃折射率 | 用 1.0（空气）→ 没折射；用 2.0（钻石）→ 折射更夸张 |
| `RIM = 0.18` | 边缘折射带宽度 | 大→折射区域更宽、更柔和；小→折射集中在很窄的边缘 |
| `GAIN = 80` | 折射强度增益（像素） | 大→偏移更夸张；小→更含蓄 |

---

### 6.2 升级二：filtered background copy（跨浏览器的关键）

这是 outpace 方案**最重要也最巧妙**的一步。

#### backdrop-filter 的陷阱

简化版用 `backdrop-filter: url(#glass-filter)`。看起来很自然——"对背景应用滤镜"嘛。但 outpace 的文章一针见血指出：

> `backdrop-filter` will run an SVG displacement filter, but only in Chromium. Safari and Firefox accept the property, silently drop the SVG part, and leave you a flat blur.

翻译：**Safari 和 Firefox 接受 `backdrop-filter` 这个属性，但静默丢掉里面的 SVG 滤镜部分，只留一个模糊**。你写 `backdrop-filter: url(#glass) blur(2px)`，在 Safari 里只有 `blur(2px)` 生效，`url(#glass)` 像不存在一样。

这就是为什么网上绝大多数"液态玻璃"教程在 Chrome 里看着是玻璃，到 Safari 就成了磨砂板。

#### 解决思路：别过滤背景，过滤背景的"副本"

`feDisplacementMap` 通过**普通 `filter` 属性**在所有浏览器都工作。**只有 `backdrop-filter` 才有 Chromium-only 的限制。**

所以方案是：

1. 把背景**渲染两次**：一份是真的背景（用户看到的），另一份是它的**克隆副本**。
2. 把副本放进玻璃卡片内部，**位置和真背景完全对齐**。
3. 对副本应用 `filter: url(#glass-filter)`（普通 filter，不是 backdrop-filter）。
4. 卡片用 `overflow: hidden + border-radius` 当"窗口"裁剪副本 = 透镜。

副本被折射，看起来就像"卡片背后的真背景被折射了"。**真背景本身从未被过滤，所以没有跨浏览器问题。**

#### 反向定位：让副本"屏幕固定"

副本在卡片内部，但卡片会跟随鼠标移动。如果副本跟着卡片一起动，它显示的就不是"卡片背后那块背景"了。

**解决**：副本用**反向 transform** 抵消卡片的移动——卡片往右移 100px，副本就往左移 100px。这样**副本在屏幕上始终固定在 (0,0)**，永远显示完整的背景，被卡片窗口裁剪出来。

```js
// 卡片：跟随鼠标
card.style.transform   = `translate3d(${curX}px, ${curY}px, 0)`;
// 副本：反向 → 在 viewport 上始终固定在 (0,0)
copy.style.transform   = `translate3d(${-curX}px, ${-curY}px, 0)`;
```

数学验证：副本视觉位置 = 卡片位置 + 副本相对偏移 = `(curX, curY) + (-curX, -curY) = (0, 0)` ✓

#### 副本怎么生成

最简单的做法：JS 启动时 `backdrop.cloneNode(true)` 把背景 DOM 整个克隆一份塞进卡片。两份背景同时跑同样的 CSS 动画 → 视觉同步 → 玻璃里看到的是"活的"背景（光斑在动，文字在动）。

> outpace 原文用的是 React 共享一个 backdrop 实例，更严谨。教学 demo 用克隆够用，且实现简单。

**对应到 demo 代码**：`setupBackdropCopy()` 函数 + `loop()` 里的反向 transform。

---

### 6.3 升级三：blob: URL 替代 data: URI

简化版用 `canvas.toDataURL()` 把贴图变成 `data:` URI 喂给 `feImage`。outpace 文章明确警告：

> Every guide tells you to inline it as a `data:` URI; real WebKit silently refuses to load a `data:` URI inside `feImage`, the map never arrives, and the glass collapses to flat frost.

**WebKit 在 `feImage` 里静默拒绝加载 `data:` URI**——贴图根本送不到滤镜，玻璃直接塌成平面。这是最难查的坑，因为不报错、不警告，就是没效果。

**解决**：用 `canvas.toBlob()` + `URL.createObjectURL()` 生成 `blob:` URL：

```js
canvas.toBlob((blob) => {
  const url = URL.createObjectURL(blob);
  feImage.setAttribute('href', url);
});
```

`blob:` URL 在所有浏览器都正常加载。一行之差，从"Webkit 不工作"变成"全平台工作"。

---

### 6.4 分层结构：每层各司其职

简化版把所有效果塞进一个 `backdrop-filter` + `box-shadow`。升级版拆成 4 层，每层只做一件事，独立调参：

```
┌─────────────────────────────────────┐
│ 4. label        文字层              │ ← 最上
├─────────────────────────────────────┤
│ 3. specular     边缘高光层          │ ← inset box-shadow
├─────────────────────────────────────┤
│ 2. tint         冷灰调色层          │ ← 提升可读性 + 实体感
├─────────────────────────────────────┤
│ 1. backdrop-copy 折射层（背景副本） │ ← filter: url(#glass-filter)
├─────────────────────────────────────┤
│   lens box      overflow:hidden     │ ← 透镜窗口
└─────────────────────────────────────┘
```

- **折射层**：背景副本 + 滤镜，负责"扭曲"。叠加 `brightness(0.92)` 微暗化，让折射后的内容自动适应暗色卡片。
- **tint 层**：深色半透明渐变（`rgba(8,10,20,0.55)`），让卡片内部变暗，文字在明亮背景上也能清晰可读。**这是暗色玻璃的关键**——白天 Bing 照片亮度很高，不加暗色 tint 白字会看不清。
- **specular 层**：边缘高光 + 内嵌底暗（`inset box-shadow`），模拟暗色玻璃边缘反光和底部暗角。暗色主题下高光更克制。
- **label 层**：白色文字 + 深色 `text-shadow`，在暗色底上高对比度。

分层后想调任何一项都互不干扰，效果更精细。

> **关于背景**：demo 的背景层用的是**每日 Bing 美图**（`background-image: cover`），而非简化版的彩色光斑。
>
> Bing 官方 API `https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN` 返回当日图片的 `urlbase`，直接拼上 `_UHD.jpg` 即可获得 4K 分辨率。真实照片的高频细节（纹理、边缘、色彩过渡）比纯色块更能体现折射，且每天自动更新。
>
> **为什么你看到的不是每日最新图？** 最常见的原因是直接用浏览器双击 HTML（`file://` 协议）。浏览器出于安全限制，会禁止 `file://` 页面通过 `fetch()` 访问 `https://` 接口。demo 对此做了兜底：检测到 `file://` 时会自动使用一张已知可用的 Bing UHD 图片作为默认背景，并提示"Serve via http://localhost for daily updates"。**要看到真正的每日更新图，请通过本地 HTTP 服务器打开**，例如：
>
> ```bash
> # 在项目目录运行
> npx serve .
> # 或 Python 3
> python -m http.server 8080
> # 然后访问 http://localhost:8080/liquid-glass-demo.html
> ```
>
> 启动顺序：先 `setupBackdropCopy()` 克隆空背景 → `await fetchBingImage()` 获取并预加载图片 → `setBackdropImage(url)` 同时设置原背景和副本背景图。这样即使图片加载需要一点时间，玻璃结构也先就绪。

---

### 6.5 可访问性：不是所有人都想看玻璃

outpace 强调：玻璃是**增强**，不是必需。两个 media query 兜底：

#### `prefers-reduced-motion`

用户在系统设置里表示"我不想看动画"（晕动症、专注需求）。尊重它：

```js
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = reduceMotion ? 1 : 0.15;   // 系数=1 → 瞬移，不缓动
```

CSS 里也关掉背景光斑动画：

```css
@media (prefers-reduced-motion: reduce) {
  .blob { animation: none !important; }
}
```

#### `prefers-reduced-transparency`

用户在系统设置里表示"我看不清玻璃上的字"。直接退化为**不透明面板**：

```css
@media (prefers-reduced-transparency: reduce) {
  .glass-copy { filter: none; }                              /* 关掉折射 */
  .glass-tint { background: rgba(20,22,35,0.88); }            /* 实体面板 */
}
```

这两个 query 让玻璃"用得起"——不会因为效果炫酷就牺牲可访问性。

---

### 6.6 升级版整体对照

| 维度 | 简化版（第三~五节） | 升级版（demo 实际用的） |
|------|---------------------|------------------------|
| 折射来源 | `smoothStep` 手调权重 | Snell 定律 + squircle 圆顶斜率 |
| 滤镜应用 | `backdrop-filter: url(#)` | 普通 `filter: url(#)` on 背景副本 |
| 跨浏览器 | 仅 Chromium 折射；Safari/FF 模糊 | 所有浏览器都折射 |
| 贴图传输 | `data:` URI | `blob:` URL |
| 结构 | 单层卡片 | 4 层（copy/tint/specular/label） |
| 可访问性 | 无 | reduced-motion / reduced-transparency |
| 代码量 | 短 | 较长但每层清晰 |

**学习建议**：先打开简化版理解原理（折射 = 搬像素），再看升级版理解工程（怎么让它在所有浏览器都工作）。

---

## 七、进一步优化方向

升级版已经能用到真实项目。如果想再进一步，可以考虑：

1. **色散边缘（chromatic fringe）**：在折射基础上叠加 2~3 个不同 `scale` 的 displacement pass，用 R/G/B 通道分别偏移一点点 → 边缘出现彩色条纹，像真实玻璃边缘的色散。Chromium 跑在 GPU 上几乎免费；Safari 软件渲染较慢，按 outpace 的做法只在 Chromium 启用。

2. **弹簧动画跟随**：把卡片跟随鼠标的线性缓动换成**弹簧物理**（如 Framer Motion 的 spring），移动更自然、可中断。outpace 的 nav 透镜就是这么动的。

3. **单一透镜 + resize**：如果有多个交互点（如导航菜单），不要每个都建一个玻璃——用**一个透镜**在交互点之间移动并改变大小，连续感更强。

4. **Safari 滤镜 id 陷阱**：Safari 按 `id` 缓存滤镜输出，动画的透镜每次重建要换新 `id`，否则会冻在第一帧。本 demo 是静态透镜不涉及，做交互动画时要注意。

5. **Safari 滤镜大小上限**：Safari 对单个 filter 能处理的源图形大小有上限。本 demo 把背景副本 clip 在卡片窗口内（`overflow: hidden`），正好规避——做大面积玻璃时要主动 clip。

6. **JS 同步两份背景**：克隆 DOM 让两份背景独立跑 CSS 动画，长时间运行可能轻微漂移。严格同步的做法是用 JS（`requestAnimationFrame` + `performance.now()`）统一驱动两份背景的 transform，或用 React 共享一个实例。

---

## 八、完整代码

完整的、可直接运行的示例（已采用 outpace 升级版方案）见同目录下的 [`liquid-glass-demo.html`](./liquid-glass-demo.html)。

建议学习路径：

1. 先**直接打开** demo，在 Chrome / Safari / Firefox 三个浏览器里都看一遍，确认效果一致。
2. 对照本教程第三~五节，**理解折射原理**（位移贴图、feDisplacementMap）。
3. 读第六节，**理解 demo 实际用的升级方案**（Snell 折射、背景副本、blob URL）。
4. **动手改参数**：
   - 改 `IOR` 从 1.5 → 1.0 / 2.0，看折射变化
   - 改 `RIM` 从 0.18 → 0.05 / 0.4，看边缘带宽变化
   - 改 `GAIN` 从 80 → 30 / 200，看折射强度变化
   - 把 `filter: url(#glass-filter)` 换回 `backdrop-filter`，对比 Safari 里的差异
5. **试换透镜形状**：把 `roundedRectSDF` 换成圆形 SDF，看折射怎么变。
6. **进阶**：加入第七节提到的色散、弹簧动画等。

祝你玩得开心 🪟✨
