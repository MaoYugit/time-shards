<template>
  <div class="mouse-effect-container" ref="container"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import gsap from 'gsap';

const props = defineProps({
  effectType: {
    type: String,
    default: 'firework',
    validator: (value) => ['firework'].includes(value)
  },
  enabled: {
    type: Boolean,
    default: true
  }
});

const container = ref(null);

// 烟花效果
const createFirework = (x, y) => {
  const particleCount = 30;
  const colors = ['#ff0844', '#ffb199', '#ffd23f', '#00f2ea', '#7b68ee'];
  const baseColor = colors[Math.floor(Math.random() * colors.length)];
  
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'firework-particle';
    particle.style.background = baseColor;
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.boxShadow = `0 0 10px ${baseColor}`;
    container.value.appendChild(particle);
    
    const angle = (Math.PI * 2 * i) / particleCount;
    const velocity = 100 + Math.random() * 100;
    const endX = x + Math.cos(angle) * velocity;
    const endY = y + Math.sin(angle) * velocity;
    
    gsap.to(particle, {
      x: endX - x,
      y: endY - y + 50, // 重力效果
      opacity: 0,
      scale: 0,
      duration: 1 + Math.random() * 0.5,
      ease: 'power2.out',
      onComplete: () => {
        particle.remove();
      }
    });
  }
};

const handleClick = (e) => {
  if (!props.enabled) return;
  
  // 始终触发烟花效果
  createFirework(e.clientX, e.clientY);
};

onMounted(() => {
  window.addEventListener('click', handleClick);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', handleClick);
});
</script>

<style scoped>
.mouse-effect-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9999;
  overflow: hidden;
}

:deep(.petal) {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  pointer-events: none;
}

:deep(.flower-center) {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: radial-gradient(circle, #ffd700, #ff6b9d);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

:deep(.firework-particle) {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  pointer-events: none;
}

:deep(.star-particle) {
  position: absolute;
  font-size: 20px;
  pointer-events: none;
  transform: translate(-50%, -50%);
  user-select: none;
}
</style>
