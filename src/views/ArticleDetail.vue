<script setup>
import { ref, onMounted, computed, nextTick, onUnmounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useArticleStore } from "@/stores/article";
import { renderMarkdown } from "@/utils/markdown";
import CommentSection from "@/components/comment/CommentSection.vue";
import gsap from "gsap";
import { useI18n } from "vue-i18n";
import hljs from "highlight.js";
import "highlight.js/styles/atom-one-dark.css";

// --- 初始化与 Hooks ---
const route = useRoute();
const articleStore = useArticleStore();
const { t, locale } = useI18n();

// --- 数据状态 ---
const article = computed(() => articleStore.currentArticle);
const loading = computed(() => articleStore.loading);
const error = computed(() => articleStore.error);

// 目录(TOC)数据结构：树形
// [{ id: 'h2-1', text: '第一阶段', children: [{ id: 'h3-1', text: '1.1 xxx' }] }]
const tocTree = ref([]);
const activeChapterId = ref(""); // 左侧激活的 ID (H2)
const activeSectionId = ref(""); // 右侧激活的 ID (H3)

// 内容引用（用于提取目录和监听滚动）
const contentRef = ref(null);
const mainScrollRef = ref(null); // 中间滚动容器引用

// --- 计算属性 ---
const renderedContent = computed(() => {
  if (!article.value || !article.value.content) return "";
  return renderMarkdown(article.value.content);
});

// 格式化日期
const formattedDate = computed(() => {
  const dateStr = article.value?.createTime || article.value?.create_time;
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString(
      locale.value === "zh" ? "zh-CN" : "en-US",
      { year: "numeric", month: "long", day: "numeric" }
    );
  } catch (e) {
    return dateStr;
  }
});

const categoryName = computed(
  () =>
    article.value?.categoryName ||
    article.value?.category_name ||
    t("uncategorized")
);
const tags = computed(() => article.value?.tags || []);
const coverImage = computed(
  () => article.value?.coverImage || article.value?.cover_image
);

// 计算右侧应该显示的子目录 (基于左侧当前激活的章节)
const currentSubToc = computed(() => {
  const currentChapter = tocTree.value.find(
    (item) => item.id === activeChapterId.value
  );
  return currentChapter ? currentChapter.children : [];
});

// --- 核心逻辑1：生成树形目录 ---
const generateTocTree = () => {
  if (!contentRef.value) return;

  // 选取 H1, H2, H3 (假设文章正文从 H2 开始，或者 H1 为顶级)
  // 根据你的描述，"第一阶段" 应该是 H2，"第一节" 是 H3
  const headings = Array.from(contentRef.value.querySelectorAll("h1, h2, h3"));
  const tree = [];
  let currentParent = null;

  headings.forEach((heading, index) => {
    if (!heading.id) heading.id = `heading-${index}`;

    const level = parseInt(heading.tagName.substring(1));
    const item = {
      id: heading.id,
      text: heading.innerText,
      level: level,
      children: [],
    };

    // 逻辑：遇到 H1/H2 视为顶级章节(左侧)，遇到 H3 视为子节(右侧)
    // 你可以根据实际 Markdown 习惯调整这里的判断条件
    if (level <= 2) {
      // 顶级节点 (左侧显示)
      currentParent = item;
      tree.push(item);
    } else if (level === 3 && currentParent) {
      // 子节点 (右侧显示)
      currentParent.children.push(item);
    } else {
      // 孤立的 H3 或者层级更深的，暂时放到顶层或者忽略，这里做个兜底
      if (!currentParent) tree.push(item);
      else currentParent.children.push(item);
    }
  });

  tocTree.value = tree;

  // 初始化激活状态
  if (tree.length > 0) {
    activeChapterId.value = tree[0].id;
  }
};

// --- 核心逻辑2：滚动联动 (ScrollSpy) ---
const handleScroll = () => {
  if (!mainScrollRef.value || !tocTree.value.length) return;

  const container = mainScrollRef.value;
  const scrollY = container.scrollTop;
  const offset = 150; // 偏移量，避免标题刚露头就激活

  // 收集所有需要检测的 ID (包括父和子)
  const allIds = [];
  tocTree.value.forEach((parent) => {
    allIds.push({ id: parent.id, type: "parent", parentId: parent.id });
    parent.children.forEach((child) => {
      allIds.push({ id: child.id, type: "child", parentId: parent.id });
    });
  });

  // 找到当前视口最上方的标题
  let current = null;
  for (const item of allIds) {
    const el = document.getElementById(item.id);
    if (el && el.offsetTop <= scrollY + offset) {
      current = item;
    } else {
      break;
    }
  }

  if (current) {
    // 激活对应的 ID
    if (current.type === "parent") {
      activeChapterId.value = current.id;
      activeSectionId.value = ""; // 父章节刚开始，子章节可能为空
    } else {
      activeChapterId.value = current.parentId; // 确保左侧同时也激活父级
      activeSectionId.value = current.id;
    }
  }
};

// --- 跳转逻辑 ---
const scrollToHeading = (id) => {
  const element = document.getElementById(id);
  const container = mainScrollRef.value;
  if (element && container) {
    // 计算相对位置进行滚动
    container.scrollTo({
      top: element.offsetTop - 60,
      behavior: "smooth",
    });

    // 手动更新激活状态 (提升点击响应速度)
    if (tocTree.value.some((t) => t.id === id)) {
      activeChapterId.value = id;
    } else {
      activeSectionId.value = id;
    }
  }
};

// --- 生命周期 ---
onMounted(async () => {
  await articleStore.fetchArticleById(route.params.id);

  if (article.value) {
    // 简单的入场动画
    gsap.from(".main-scroll-area", { y: 20, opacity: 0, duration: 0.6 });

    nextTick(() => {
      generateTocTree();

      document.querySelectorAll("pre code").forEach((el) => {
        hljs.highlightElement(el);
      });

      // 监听中间容器的滚动，而不是 window
      if (mainScrollRef.value) {
        mainScrollRef.value.addEventListener("scroll", handleScroll);
      }
    });
  }
});

onUnmounted(() => {
  if (mainScrollRef.value) {
    mainScrollRef.value.removeEventListener("scroll", handleScroll);
  }
});

watch(
  () => route.params.id,
  async (newId) => {
    if (newId) {
      await articleStore.fetchArticleById(newId);
      nextTick(() => {
        if (mainScrollRef.value) mainScrollRef.value.scrollTop = 0;
        generateTocTree();
        document.querySelectorAll("pre code").forEach((el) => {
          hljs.highlightElement(el);
        });
      });
    }
  }
);
</script>

<template>
  <!-- 
    全屏布局容器 
    高度固定 100vh，Flex 布局，背景防止穿透
  -->
  <div class="full-screen-layout">
    <!-- 1. 左侧：文章章节 (Chapters) -->
    <aside class="sidebar left-sidebar">
      <div class="sidebar-header">{{ t("chapters") || "Chapters" }}</div>
      <nav class="toc-nav">
        <ul>
          <li
            v-for="chapter in tocTree"
            :key="chapter.id"
            class="chapter-item"
            :class="{ active: activeChapterId === chapter.id }"
            @click.prevent="scrollToHeading(chapter.id)"
          >
            <span class="chapter-text">{{ chapter.text }}</span>
            <span
              class="chapter-indicator"
              v-if="activeChapterId === chapter.id"
            ></span>
          </li>
        </ul>
        <div v-if="tocTree.length === 0" class="empty-state">
          {{ t("no_catalog") }}
        </div>
      </nav>
    </aside>

    <!-- 2. 中间：内容区域 (Main Content) - 独立滚动 -->
    <main class="main-scroll-area" ref="mainScrollRef">
      <div class="article-wrapper">
        <!-- 错误/加载状态 -->
        <div v-if="loading" class="state-msg">{{ t("loading") }}...</div>
        <div v-else-if="error" class="state-msg">{{ t("error") }}</div>

        <article v-else-if="article" class="article-card">
          <!-- 头部信息 -->
          <header class="article-header">
            <!-- 标题 -->
            <h1 class="title">{{ article.title }}</h1>

            <!-- Meta 信息：统一在标题下方 -->
            <div class="meta-container">
              <!-- 标签 -->
              <div class="tags-group" v-if="tags.length">
                <span v-for="tag in tags" :key="tag.id" class="tag-badge"
                  >#{{ tag.name }}</span
                >
              </div>

              <!-- 分隔线或间距 -->
              <div class="meta-divider" v-if="tags.length"></div>

              <!-- 分类与时间 -->
              <div class="info-group">
                <span class="meta-item category-badge">
                  <i class="icon-folder"></i> {{ categoryName }}
                </span>
                <span class="meta-item date">
                  <i class="icon-calendar"></i> {{ formattedDate }}
                </span>
                <span class="meta-item views">
                  <i class="icon-eye"></i> {{ article.viewCount || 0 }}
                </span>
              </div>
            </div>

            <!-- 封面图 (尺寸优化) -->
            <div v-if="coverImage" class="article-cover">
              <img :src="coverImage" alt="Article Cover" />
            </div>
          </header>

          <!-- 正文 -->
          <div
            ref="contentRef"
            class="article-content markdown-body"
            v-html="renderedContent"
          ></div>

          <div class="article-footer">
            <p>— End —</p>
          </div>

          <!-- 评论区 -->
          <CommentSection :articleId="article.id" />
        </article>
      </div>
    </main>

    <!-- 3. 右侧：当前章节的子目录 (Sections) -->
    <aside class="sidebar right-sidebar">
      <div class="sidebar-header">
        <!-- 显示当前激活的章节标题，增强上下文感 -->
        {{
          tocTree.find((c) => c.id === activeChapterId)?.text ||
          t("catalog") ||
          "Section"
        }}
      </div>

      <transition name="fade" mode="out-in">
        <nav class="toc-nav" :key="activeChapterId">
          <ul v-if="currentSubToc.length > 0">
            <li
              v-for="sub in currentSubToc"
              :key="sub.id"
              class="section-item"
              :class="{ active: activeSectionId === sub.id }"
              @click.prevent="scrollToHeading(sub.id)"
            >
              {{ sub.text }}
            </li>
          </ul>
          <div v-else class="empty-sub-state">
            {{ t("no_subsections") || "No subsections" }}
          </div>
        </nav>
      </transition>
    </aside>
  </div>
</template>

<style scoped>
/* --- 布局核心：全屏 + Flex --- */
.full-screen-layout {
  display: flex;
  width: 100%;
  height: 100vh; /* 关键：固定高度占满屏幕 */
  overflow: hidden; /* 关键：禁止 body 滚动 */
  background: transparent; /* 透出你原来的星空背景 */
  color: #eee;
}

/* --- 侧边栏通用样式 --- */
.sidebar {
  width: 260px; /* 固定宽度 */
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  text-align: left;
  background: rgba(0, 0, 0, 0.3); /* 半透明黑背景 */
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(5px);
  padding: 1.5rem 1rem;
  z-index: 10;
}

.right-sidebar {
  border-right: none;
  border-left: 1px solid rgba(255, 255, 255, 0.05);
}

.sidebar-header {
  font-size: 1.1rem;
  font-weight: bold;
  color: #00ff9d; /* 强调色 */
  margin-bottom: 1.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(0, 255, 157, 0.2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

/* 侧边栏导航列表 */
.toc-nav {
  overflow-y: auto;
  flex: 1;
}

/* 滚动条美化 */
.toc-nav::-webkit-scrollbar,
.main-scroll-area::-webkit-scrollbar {
  width: 4px;
}
.toc-nav::-webkit-scrollbar-thumb,
.main-scroll-area::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 2px;
}

/* --- 左侧：章节样式 --- */
.chapter-item {
  position: relative;
  padding: 12px 15px;
  margin-bottom: 8px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.3s;
  color: #aaa;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chapter-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.chapter-item.active {
  background: linear-gradient(90deg, rgba(0, 255, 157, 0.1), transparent);
  color: #00ff9d;
  font-weight: bold;
}

.chapter-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #00ff9d;
  box-shadow: 0 0 8px #00ff9d;
}

/* --- 右侧：子节样式 --- */
.section-item {
  padding: 8px 10px 8px 15px;
  font-size: 0.9rem;
  color: #888;
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: all 0.2s;
  line-height: 1.4;
  margin-bottom: 4px;
  text-align: left;
}

.section-item:hover {
  color: #ccc;
  border-left-color: #555;
}

.section-item.active {
  color: #00d2ff; /* 右侧用蓝色区分 */
  border-left-color: #00d2ff;
  background: linear-gradient(90deg, rgba(0, 210, 255, 0.05), transparent);
}

.empty-state,
.empty-sub-state {
  color: #555;
  font-style: italic;
  font-size: 0.9rem;
  margin-top: 1rem;
}

/* --- 中间：主要内容区 (独立滚动) --- */
.main-scroll-area {
  flex: 1; /* 占据剩余空间 */
  overflow-y: auto; /* 关键：内容在此区域内滚动 */
  scroll-behavior: smooth;
  padding: 2rem; /* 给文章两边留白 */
  position: relative;
}

.article-wrapper {
  max-width: 850px; /* 限制文章最大宽度，保持阅读体验 */
  margin: 0 auto;
  padding-bottom: 100px; /* 底部留白，方便最后的内容能滚上来 */
  text-align: left;
}

:deep(.markdown-body pre) {
  /* 强制代码块黑色背景，配合你的暗色主题 */
  background-color: #1e1e1e !important;
  border-radius: 8px;
  /* 允许横向滚动，防止撑破布局 */
  overflow-x: auto;
  padding: 1rem;
  margin: 1.5rem 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

:deep(.markdown-body code) {
  /* 设置代码字体，推荐 Fira Code 或 Consolas */
  font-family: "Fira Code", Consolas, monospace;
  font-size: 0.95rem;
}

/* Header 样式重构 */
.article-header {
  margin-bottom: 3rem;
  text-align: left; /* 左对齐 */
}

.title {
  font-size: 2.8rem;
  line-height: 1.2;
  margin-bottom: 1.5rem;
  color: #fff;
  text-shadow: 0 0 20px rgba(0, 255, 157, 0.2);
}

/* Meta 容器：Tag 和 Info 上下排列 */
.meta-container {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding-left: 4px;
  border-left: 4px solid #00ff9d; /* 左侧装饰线 */
  padding-left: 1rem;
}

.tags-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-badge {
  background: rgba(0, 255, 157, 0.15);
  color: #00ff9d;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.85rem;
  font-family: monospace;
}

.info-group {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  color: #888;
  font-size: 0.9rem;
  font-family: monospace;
}

.category-badge {
  color: #00d2ff;
  font-weight: bold;
}

/* 封面图优化 */
.article-cover {
  margin-top: 2rem;
  width: 100%;
  max-height: 350px; /* 限制高度，不要占满屏幕 */
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.article-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Markdown 样式微调 */
.article-content {
  margin-top: 2rem;
  line-height: 1.8;
  font-size: 1.1rem;
  color: #e0e0e0;
}

/* 响应式适配 */
@media (max-width: 1200px) {
  .full-screen-layout {
    flex-direction: column;
    height: auto;
    overflow: auto;
  }
  .sidebar {
    display: none; /* 小屏隐藏侧边栏，或者改成抽屉 */
  }
  .main-scroll-area {
    padding: 1rem;
    overflow: visible;
  }
}
</style>
