<template>
  <div class="app-container">
    <!-- 背景管理器 -->
    <BackgroundManager :backgroundType="settingsStore.backgroundType" />

    <!-- 鼠标特效 -->
    <MouseEffectManager
      :effectType="settingsStore.mouseEffect"
      :enabled="settingsStore.mouseEffectEnabled"
    />

    <!-- 导航栏 -->
    <Navbar />

    <!-- 主内容区域 -->
    <main>
      <router-view />
    </main>

    <!-- 页脚 -->
    <Footer />
  </div>
</template>

<script setup>
import { useThemeStore } from "./stores/theme";
import { useSettingsStore } from "./stores/settings";
import Navbar from "./components/layout/Navbar.vue";
import Footer from "./components/layout/Footer.vue";
import BackgroundManager from "./components/background/BackgroundManager.vue";
import MouseEffectManager from "./components/effects/MouseEffectManager.vue";

const themeStore = useThemeStore();
const settingsStore = useSettingsStore();
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  background-color: var(--color-bg);
  color: var(--color-text-main);
  transition: background-color var(--transition-speed),
    color var(--transition-speed);
  display: flex;
  flex-direction: column;
}

main {
  flex: 1;
}
</style>
