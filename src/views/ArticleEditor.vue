<script setup>
import { ref, onMounted, computed, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

// --- 引入编辑器组件 ---
import VditorEditor from "@/components/common/VditorEditor.vue";

// --- 引入 Store 和 API ---
import { useUserStore } from "@/stores/user";
import { createArticle, updateArticle, getArticleById } from "@/api/article";
import { uploadFile } from "@/api/attachment";
import { getCategories, createCategory } from "@/api/category";
import { getTags, createTag } from "@/api/tag";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const { t } = useI18n();

// --- 状态定义 ---
const isEditMode = computed(() => !!route.params.id);
const loading = ref(false);
const saving = ref(false);

// 表单数据
const form = ref({
  title: "",
  summary: "",
  content: "",
  coverImage: "",
  categoryId: "", // 存储选中的分类 ID
  status: 1,
  tags: [], // 存储选中的 Tag 对象列表
});

// 元数据（从后端获取的完整列表）
const categories = ref([]);
const availableTags = ref([]);

// UI 交互状态
const catSearchText = ref(""); // 分类输入框文本
const tagSearchText = ref(""); // 标签输入框文本
const showCatDropdown = ref(false); // 控制分类下拉菜单
const showTagDropdown = ref(false); // 控制标签下拉菜单
const catInputRef = ref(null);
const tagInputRef = ref(null);

// --- 辅助函数：生成 Slug ---
const generateSlug = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

// --- 编辑器上传回调 ---
const handleEditorUpload = async (files, vditorInstance) => {
  const file = files[0];
  if (!file) return;
  try {
    const res = await uploadFile(file, userStore.user.id);
    // 建议：baseURL 最好放入 import.meta.env.VITE_API_URL
    const baseURL = "http://localhost:8080";
    const url = baseURL + res.fileUrl;
    vditorInstance.insertValue(`![${file.name}](${url})`);
    return null;
  } catch (error) {
    console.error("Upload failed:", error);
    return "Upload failed";
  }
};

// ==========================================
// --- Category 逻辑 (已重构，模仿 Tag 交互) ---
// ==========================================

// 1. 计算属性：过滤分类列表
const filteredCategories = computed(() => {
  if (!catSearchText.value) return categories.value;
  return categories.value.filter((c) =>
    c.name.toLowerCase().includes(catSearchText.value.toLowerCase())
  );
});

// 2. 计算属性：获取当前选中的分类对象（用于显示 Chip）
const selectedCategory = computed(() => {
  if (!form.value.categoryId) return null;
  return categories.value.find((c) => c.id === form.value.categoryId);
});

// 3. 选中分类
const selectCategory = (cat) => {
  form.value.categoryId = cat.id;
  catSearchText.value = ""; // 清空输入
  showCatDropdown.value = false; // 关闭下拉
};

// 4. 移除分类
const removeCategory = () => {
  form.value.categoryId = "";
  catSearchText.value = "";
  // 移除后，DOM 更新让 input 重新出现，需要等待 tick 后聚焦
  nextTick(() => {
    catInputRef.value?.focus();
  });
};

// 5. 创建或选中分类 (回车键触发)
const handleCreateCategory = async () => {
  const name = catSearchText.value.trim();
  if (!name) return;

  // A. 查重：如果本地已有，直接选中
  const existing = categories.value.find((c) => c.name === name);
  if (existing) {
    selectCategory(existing);
    return;
  }

  // B. 创建：调用 API
  try {
    const newCat = {
      name: name,
      slug: generateSlug(name) || `cat-${Date.now()}`,
    };
    const res = await createCategory(newCat);
    categories.value.push(res); // 更新本地列表
    selectCategory(res); // 选中新建项
  } catch (error) {
    console.error("Create category failed:", error);
  }
};

// ==========================================
// --- Tag 逻辑 (保持不变，用于对比) ---
// ==========================================

const filteredTags = computed(() => {
  const selectedIds = new Set(form.value.tags.map((t) => t.id));
  let list = availableTags.value.filter((t) => !selectedIds.has(t.id));
  if (tagSearchText.value) {
    list = list.filter((t) =>
      t.name.toLowerCase().includes(tagSearchText.value.toLowerCase())
    );
  }
  return list;
});

const selectTag = (tag) => {
  form.value.tags.push(tag);
  tagSearchText.value = "";
  showTagDropdown.value = false;
  tagInputRef.value?.focus();
};

const removeTag = (index) => {
  form.value.tags.splice(index, 1);
};

const handleCreateTag = async () => {
  const name = tagSearchText.value.trim();
  if (!name) return;
  const existing = availableTags.value.find((t) => t.name === name);
  if (existing) {
    const isSelected = form.value.tags.find((t) => t.id === existing.id);
    if (!isSelected) selectTag(existing);
    return;
  }
  try {
    const newTag = {
      name: name,
      slug: generateSlug(name) || `tag-${Date.now()}`,
    };
    const res = await createTag(newTag);
    availableTags.value.push(res);
    selectTag(res);
  } catch (error) {
    console.error("Create tag failed:", error);
  }
};

const handleTagInputDelete = () => {
  if (tagSearchText.value === "" && form.value.tags.length > 0) {
    form.value.tags.pop();
  }
};

// ==========================================
// --- 数据初始化 ---
// ==========================================
const fetchMetadata = async () => {
  try {
    const [catRes, tagRes] = await Promise.all([getCategories(), getTags()]);
    categories.value = catRes || [];
    availableTags.value = tagRes || [];
  } catch (error) {
    console.error("Metadata error:", error);
  }
};

const initForm = async () => {
  if (!userStore.isLoggedIn) {
    router.push("/login");
    return;
  }
  await fetchMetadata();

  if (isEditMode.value) {
    loading.value = true;
    try {
      const article = await getArticleById(route.params.id);

      // 处理 Tags 回显
      let currentTags = [];
      if (article.tags && article.tags.length > 0) {
        if (typeof article.tags[0] === "object") {
          currentTags = article.tags;
        } else {
          currentTags = availableTags.value.filter((t) =>
            article.tags.includes(t.id)
          );
        }
      }

      form.value = {
        ...article,
        tags: currentTags,
      };
      // categoryId 已经在 article 对象中，无需额外处理
    } catch (error) {
      console.error("Article load error:", error);
    } finally {
      loading.value = false;
    }
  }
};

// ==========================================
// --- 保存发布逻辑 (包含自动创建分类补丁) ---
// ==========================================
const handleCoverUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const res = await uploadFile(file, userStore.user.id);
    const fullUrl = "http://localhost:8080" + res.fileUrl;
    form.value.coverImage = fullUrl;
  } catch (error) {
    console.error("Cover upload failed:", error);
  }
};

const saveArticle = async () => {
  // 1. 基础校验
  if (!form.value.title || !form.value.content) {
    alert(t("title_content_required"));
    return;
  }

  saving.value = true;
  try {
    // --- 自动补全分类逻辑 START ---
    // 如果用户输入了分类名，但没按回车选中（categoryId为空，但输入框有值）
    let finalCategoryId = form.value.categoryId;

    if (!finalCategoryId && catSearchText.value.trim()) {
      const name = catSearchText.value.trim();
      const existing = categories.value.find((c) => c.name === name);

      if (existing) {
        finalCategoryId = existing.id;
      } else {
        // 尝试自动创建
        try {
          const newCat = {
            name: name,
            slug: generateSlug(name) || `cat-${Date.now()}`,
          };
          const res = await createCategory(newCat);
          categories.value.push(res);
          finalCategoryId = res.id;
        } catch (err) {
          console.error("Auto create category failed:", err);
        }
      }
    }
    // --- 自动补全分类逻辑 END ---

    const data = {
      ...form.value,
      categoryId: finalCategoryId, // 使用处理后的 ID
      user_id: userStore.user.id,
      tags: form.value.tags,
    };

    if (isEditMode.value) {
      await updateArticle(data);
    } else {
      await createArticle(data);
    }
    router.push("/");
  } catch (error) {
    console.error("Save failed:", error);
    alert(t("save_failed"));
  } finally {
    saving.value = false;
  }
};

// 点击外部关闭下拉菜单
const handleClickOutside = (e) => {
  const sidebar = document.querySelector(".sidebar");
  if (sidebar && !sidebar.contains(e.target)) {
    showTagDropdown.value = false;
    showCatDropdown.value = false; // 同时也关闭分类下拉
  }
};

onMounted(() => {
  initForm();
  document.addEventListener("click", handleClickOutside);
});
</script>

<template>
  <div class="editor-container">
    <!-- 顶部 Header -->
    <div class="editor-header">
      <h2>{{ isEditMode ? t("edit_shard_title") : t("new_shard_title") }}</h2>
      <div class="actions">
        <button @click="saveArticle" class="primary-btn" :disabled="saving">
          {{ saving ? t("saving") : t("publish") }}
        </button>
      </div>
    </div>

    <div class="editor-layout">
      <!-- 左侧主编辑区 -->
      <div class="main-editor">
        <div class="form-group title-group">
          <input
            v-model="form.title"
            :placeholder="t('title_placeholder')"
            class="title-input"
          />
        </div>

        <div class="editor-wrapper-container">
          <VditorEditor
            v-model="form.content"
            :upload-handler="handleEditorUpload"
            height="100%"
          />
        </div>
      </div>

      <!-- 右侧侧边栏 -->
      <div class="sidebar">
        <!-- Category (已修改为和 Tag 同样的交互样式) -->
        <div class="form-group relative-group">
          <label>{{ t("category_label") }}</label>

          <!-- 容器：复用 tags-input-container 样式 -->
          <div
            class="tags-input-container"
            :class="{ active: showCatDropdown }"
            @click="catInputRef?.focus()"
          >
            <!-- 选中状态：显示橙色 Chip -->
            <span v-if="selectedCategory" class="tag-chip is-category">
              {{ selectedCategory.name }}
              <i @click.stop="removeCategory">&times;</i>
            </span>

            <!-- 未选中状态：显示输入框 -->
            <input
              v-else
              ref="catInputRef"
              v-model="catSearchText"
              @focus="showCatDropdown = true"
              @input="showCatDropdown = true"
              @keydown.enter.prevent="handleCreateCategory"
              :placeholder="t('category_placeholder')"
              class="tag-input-field"
              autocomplete="off"
            />
          </div>

          <!-- Category 下拉菜单 -->
          <ul v-if="showCatDropdown && !selectedCategory" class="dropdown-menu">
            <!-- 渲染现有分类 -->
            <li
              v-for="cat in filteredCategories"
              :key="cat.id"
              @click="selectCategory(cat)"
            >
              {{ cat.name }}
            </li>

            <!-- 渲染创建选项 -->
            <li
              v-if="filteredCategories.length === 0 && catSearchText"
              class="create-option"
              @click="handleCreateCategory"
            >
              {{ t("create_tag_fmt") }} "{{ catSearchText }}"
            </li>
          </ul>
        </div>

        <!-- Tags (保持不变) -->
        <div class="form-group relative-group">
          <label>{{ t("tags_label") }}</label>
          <div
            class="tags-input-container"
            :class="{ active: showTagDropdown }"
            @click="tagInputRef?.focus()"
          >
            <span
              v-for="(tag, index) in form.tags"
              :key="tag.id"
              class="tag-chip"
            >
              {{ tag.name }}
              <i @click.stop="removeTag(index)">&times;</i>
            </span>
            <input
              ref="tagInputRef"
              v-model="tagSearchText"
              @focus="showTagDropdown = true"
              @input="showTagDropdown = true"
              @keydown.enter.prevent="handleCreateTag"
              @keydown.backspace="handleTagInputDelete"
              :placeholder="t('tags_placeholder')"
              class="tag-input-field"
              autocomplete="off"
            />
          </div>
          <ul v-if="showTagDropdown && tagSearchText" class="dropdown-menu">
            <li
              v-for="tag in filteredTags"
              :key="tag.id"
              @click="selectTag(tag)"
            >
              {{ tag.name }}
            </li>
            <li
              v-if="filteredTags.length === 0"
              class="create-option"
              @click="handleCreateTag"
            >
              {{ t("create_tag_fmt") }} "{{ tagSearchText }}"
            </li>
          </ul>
        </div>

        <!-- Summary & Cover -->
        <div class="form-group">
          <label>{{ t("summary_label") }}</label>
          <textarea v-model="form.summary" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label>{{ t("cover_image_label") }}</label>
          <input type="file" @change="handleCoverUpload" accept="image/*" />
          <div v-if="form.coverImage" class="image-preview">
            <img :src="form.coverImage" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 容器布局 */
.editor-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
  height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.editor-layout {
  display: flex;
  gap: 2rem;
  flex: 1;
  overflow: hidden;
}

.main-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-wrapper-container {
  flex: 1;
  overflow: hidden;
}

.title-input {
  font-size: 2rem;
  font-weight: bold;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-main);
  width: 100%;
  padding: 0.5rem 0;
  margin-bottom: 1rem;
  outline: none;
}

/* 侧边栏基础 */
.sidebar {
  width: 300px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 1rem;
}

.form-group {
  margin-bottom: 1.5rem;
}
.relative-group {
  position: relative;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #aaa;
  font-size: 0.9rem;
}

.form-group input,
.form-group textarea {
  width: 100%;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--color-border);
  color: #eee;
  padding: 0.5rem;
  border-radius: 4px;
  outline: none;
}
.form-group input:focus,
.form-group textarea:focus {
  border-color: #00ff9d;
}

/* ========================================= */
/* === 核心：统一 Category 和 Tag 的样式 === */
/* ========================================= */

/* 输入框容器 */
.tags-input-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--color-border);
  padding: 0.4rem;
  border-radius: 4px;
  min-height: 38px;
  cursor: text;
  transition: border-color 0.2s;
}

/* 聚焦时的高亮 */
.tags-input-container:focus-within,
.tags-input-container.active {
  border-color: #00ff9d;
}

/* 隐形输入框 */
.tag-input-field {
  flex: 1;
  min-width: 60px;
  background: transparent !important;
  border: none !important;
  padding: 0.2rem !important;
  margin: 0 !important;
  color: #eee;
  outline: none;
}
.tag-input-field:focus {
  box-shadow: none !important;
}

/* Chip 标签基础样式 (默认 Tags 使用绿色) */
.tag-chip {
  background: rgba(0, 255, 157, 0.15); /* 浅绿背景 */
  color: #00ff9d; /* 亮绿文字 */
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  user-select: none;
}

/* Chip 变体：Category 专用样式 (使用橙色系区分) */
.tag-chip.is-category {
  background: rgba(255, 165, 0, 0.15); /* 浅橙背景 */
  color: #ff9d00; /* 亮橙文字 */
}

/* 这里的删除图标 */
.tag-chip i {
  cursor: pointer;
  font-style: normal;
  font-weight: bold;
  opacity: 0.7;
}
.tag-chip i:hover {
  opacity: 1;
  color: #fff;
}

/* 下拉菜单 */
.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #2a2a2a;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  margin-top: 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
  list-style: none;
  padding: 0;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.5);
}

.dropdown-menu li {
  padding: 0.5rem;
  cursor: pointer;
  color: #ddd;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 0.9rem;
}

.dropdown-menu li:hover {
  background: rgba(0, 255, 157, 0.2);
  color: #fff;
}

.create-option {
  color: #00ff9d !important;
  font-weight: bold;
  border-top: 1px solid #444;
}

/* 图片预览 & 按钮 */
.image-preview img {
  width: 100%;
  margin-top: 0.5rem;
  border-radius: 4px;
}
.primary-btn {
  background: #00ff9d;
  color: #000;
  border: none;
  padding: 0.5rem 1.5rem;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
}
.primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
