<script setup lang="ts">
import { APP_NAME } from '@/shared/types/app-name'
import ThemeToggle from '@/shared/ui/ThemeToggle.vue'
</script>

<template>
  <div :class="$style.shell">
    <ThemeToggle :class="$style.toggle" />
    <main :class="$style.main">
      <header :class="$style.header">
        <div :class="$style.brand">
          <div :class="$style.mark">26</div>
          <div :class="$style.brandText">
            WC Schedule
            <small>{{ APP_NAME }}</small>
          </div>
        </div>
      </header>
    </main>
  </div>
</template>

<style module>
.shell {
  position: relative;
  min-height: 100vh;
  background-color: var(--bg-page);
}

.toggle {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 100;
}

.main {
  max-width: 480px;
  margin: 0 auto;
  padding: 28px 22px 40px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mark {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%);
  display: grid;
  place-items: center;
  color: #ffffff;
  font-weight: 800;
  font-size: 15px;
  box-shadow: var(--shadow-sm);
}

.brandText {
  font-weight: 700;
  font-size: 15px;
  color: var(--text-strong);
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.brandText small {
  display: block;
  font-weight: 500;
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.02em;
}
</style>
