# CookLikeHOC

老乡鸡菜品展示网站，支持菜谱浏览、分类筛选、详情查看和分享图生成。

## 技术栈

- **React 19** + **React Router 7**
- **Vite 8** 构建工具
- **Ant Design Icons** 图标库
- 纯 CSS 样式（玻璃拟态风格）

## 功能

- 首页精选推荐（横向滑动）
- 分类浏览（炒菜、蒸菜、炖菜、炸品、主食等）
- 菜谱详情（食材、调料、步骤）
- 分享图生成（Canvas 动态渲染，自适应字号）
- 相关菜谱推荐
- 响应式布局

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

产物在 `dist/` 目录。

## 部署

推荐使用 Cloudflare Pages：

1. 连接 GitHub 仓库
2. 构建命令：`npm run build`
3. 输出目录：`dist`
4. 框架预设：Vite

## 项目结构

```
├── public/
│   └── images/          # 菜谱图片
├── scripts/             # 数据同步脚本
├── src/
│   ├── assets/          # 静态资源
│   ├── data/            # 菜谱数据
│   ├── App.jsx          # 主组件
│   ├── App.css          # 样式
│   └── main.jsx         # 入口
├── index.html
└── vite.config.js
```
