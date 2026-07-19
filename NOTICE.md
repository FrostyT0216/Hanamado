# 第三方资源声明 (NOTICE)

本项目（話窓 Hanamado）的源代码遵循 [CC BY-NC 4.0 许可证](./LICENSE)（署名-非商业性使用 4.0）。

此外，项目内打包/引用的部分数据资源（词库、词典、图标等）来自第三方，具有**独立的版权和许可条款**。这些资源的许可证**优先于**项目本身的 CC BY-NC 4.0 许可证，用户在使用、再分发或二次创作时必须分别遵守对应资源的许可条款。

---

## 1. JLPT 词库数据

| 项目 | 说明 |
|------|------|
| **资源位置** | `public/data/vocab-n1.json`、`vocab-n2.json`、`vocab-n3.json`、`vocab-n4.json`、`vocab-n5.json`、`vocab-index.json`、`vocab-search.json` |
| **来源仓库** | [5mdld/anki-jlpt-decks](https://github.com/5mdld/anki-jlpt-decks)（牌组：[egg rolls] JLPT N1-N5 一万词 v3.5） |
| **原作者** | 5mdld（egg rolls） |
| **数据获取方式** | 由 `scripts/parse-vocab.ts` 从上游仓库 `deck-source/notes.csv` 解析、按等级拆分生成 |
| **许可证** | [Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/) |
| **关键约束** | **禁止商业使用**；使用时必须署名；衍生作品须继续遵守 NC 约束 |

**署名示例**：

> JLPT 词库数据来源于 5mdld 的 anki-jlpt-decks 项目（https://github.com/5mdld/anki-jlpt-decks），采用 CC BY-NC 4.0 许可证。

---

## 2. 日中词典数据

| 项目 | 说明 |
|------|------|
| **资源位置** | `public/dict/jmdict-zh.json` |
| **来源仓库** | [jiang-wei/local-jmdict-zh](https://github.com/jiang-wei/local-jmdict-zh) |
| **上游数据源** | [EDRDG JMdict](https://www.edrdg.org/jmdict/j_jmdict.html)（电子辞書研究所） |
| **原作者** | jiang-wei；上游数据 © EDRDG |
| **许可证** | [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/) |
| **关键约束** | 使用时必须署名；衍生作品须以**相同许可证**（CC BY-SA 4.0）发布 |

**署名示例**：

> 日中词典数据来源于 jiang-wei/local-jmdict-zh（https://github.com/jiang-wei/local-jmdict-zh），基于 EDRDG 的 JMdict 项目（https://www.edrdg.org/jmdict/j_jmdict.html），采用 CC BY-SA 4.0 许可证。

---

## 3. 游戏图标

| 项目 | 说明 |
|------|------|
| **资源位置** | `src/components/icons/iconData.ts`（内嵌 SVG path 数据） |
| **图标封装组件** | `src/components/common/GameIcon.tsx` |
| **来源** | [game-icons.net](https://game-icons.net/)（GitHub 仓库：[game-icons/icons](https://github.com/game-icons/icons)） |
| **主要作者** | Delapouite、Lorc、Skoll、Caro Asercion、Viscious Speed、sbed 等众多贡献者（完整作者列表见 [game-icons.net/about.html](https://game-icons.net/about.html#authors)） |
| **许可证** | [Creative Commons Attribution 3.0 Unported (CC BY 3.0)](https://creativecommons.org/licenses/by/3.0/) |
| **关键约束** | 使用时必须署名原作者 |

**署名示例**：

> 部分图标来源于 game-icons.net（https://game-icons.net/），由 Delapouite、Lorc 等作者创作，采用 CC BY 3.0 许可证。

---

## 4. 项目自有代码

| 项目 | 说明 |
|------|------|
| **资源范围** | 除上述第三方数据外的全部源代码、构建脚本、配置文件 |
| **许可证** | [Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](./LICENSE) |
| **版权年份** | 2026 |
| **版权持有人** | [FrostyT0216](https://github.com/FrostyT0216) |
| **关键约束** | **禁止商业使用**；使用时必须署名；不得未经许可用于商业目的 |

**署名示例**：

> 話窓 Hanamado 项目源代码 © 2026 FrostyT0216（https://github.com/FrostyT0216），采用 CC BY-NC 4.0 许可证（https://creativecommons.org/licenses/by-nc/4.0/）。

---

## 重要提示

1. **许可证层级关系**：本项目的 CC BY-NC 4.0 许可证适用于项目自有的源代码。第三方数据资源保留各自原始许可证，且**原许可证优先**。
2. **非商业性约束（适用于项目代码与 JLPT 词库）**：项目源代码与 JLPT 词库均采用 CC BY-NC 4.0，任何再分发或衍生作品**不得用于商业目的**。若希望将项目代码用于商业用途，需获得 FrostyT0216（https://github.com/FrostyT0216）的单独授权；若希望移除词库的 NC 约束，需自行替换为其他许可的词库数据。
3. **CC BY-SA 4.0 的相同方式分享约束**：对 JMdict-zh 词典数据进行修改或构建衍生作品时，衍生作品必须以 CC BY-SA 4.0 许可证发布。
4. **CC BY 3.0 的署名约束**：使用游戏图标时必须署名原作者（Delapouite、Lorc 等）。
5. **再分发须知**：再分发本项目的构建产物（如 `dist/` 目录）时，必须同时保留本 `NOTICE.md` 文件、`LICENSE` 文件及对应数据资源的许可证声明，确保最终用户能够知悉各部分资源的许可条款。
