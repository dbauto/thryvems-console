/** Action and change handlers registered by page modules; render/navigate/toast are set by main.js. */
export const registry = { actions: {}, changes: {}, counts: {}, render: () => {}, navigate: () => {}, toast: () => {} };
export const rerender = () => registry.render();
export const go = (hash) => registry.navigate(hash);
export const notify = (m) => registry.toast(m);
