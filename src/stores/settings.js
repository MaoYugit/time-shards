import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export const useSettingsStore = defineStore('settings', () => {
    // 鼠标特效设置
    const mouseEffect = ref(localStorage.getItem('mouseEffect') || 'flower');
    const mouseEffectEnabled = ref(localStorage.getItem('mouseEffectEnabled') !== 'false');

    // 背景设置
    const backgroundType = ref(localStorage.getItem('backgroundType') || 'shards');

    // 监听变化并持久化
    watch(mouseEffect, (val) => localStorage.setItem('mouseEffect', val));
    watch(mouseEffectEnabled, (val) => localStorage.setItem('mouseEffectEnabled', val));
    watch(backgroundType, (val) => localStorage.setItem('backgroundType', val));

    // 设置选项定义（用于UI渲染）
    const mouseEffectOptions = [
        { type: 'flower', name: 'effect_flower', icon: '🌸', description: 'effect_flower_desc' },
        { type: 'firework', name: 'effect_firework', icon: '🎆', description: 'effect_firework_desc' },
        { type: 'star', name: 'effect_star', icon: '✨', description: 'effect_star_desc' }
    ];

    const backgroundOptions = [
        { type: 'shards', name: 'bg_shards', icon: '💎', description: 'bg_shards_desc' },
        { type: 'nebula', name: 'bg_nebula', icon: '🌌', description: 'bg_nebula_desc' },
        { type: 'matrix', name: 'bg_matrix', icon: '💚', description: 'bg_matrix_desc' },
        { type: 'galaxy', name: 'bg_galaxy', icon: '🌀', description: 'bg_galaxy_desc' }
    ];

    // Actions
    const setMouseEffect = (type) => {
        mouseEffect.value = type;
    };

    const toggleMouseEffect = (enabled) => {
        mouseEffectEnabled.value = enabled;
    };

    const setBackgroundType = (type) => {
        backgroundType.value = type;
    };

    return {
        mouseEffect,
        mouseEffectEnabled,
        backgroundType,
        mouseEffectOptions,
        backgroundOptions,
        setMouseEffect,
        toggleMouseEffect,
        setBackgroundType
    };
});
