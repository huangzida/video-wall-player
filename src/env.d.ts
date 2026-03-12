/// <reference types="@modern-js/module-tools/types" />
/// <reference types="@modern-js/plugin-vue/types" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
