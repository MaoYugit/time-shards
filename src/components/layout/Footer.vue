<template>
  <footer class="footer">
    <div class="footer-container">
      <p>© {{ currentYear }} Time Shards. All rights reserved.</p>
    </div>
  </footer>
</template>

<script setup lang="ts">
const currentYear = new Date().getFullYear();
</script>

<style scoped>
.footer {
  background-color: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  padding: 2rem;
  text-align: center;
  border-top: 1px solid var(--color-border);
}
</style>
