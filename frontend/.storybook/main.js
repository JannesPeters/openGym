export default {
  stories: ['../stories/**/*.stories.jsx'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-vite',
    options: {
      builder: { viteConfigPath: false }
    }
  },
  core: { disableTelemetry: true },
  async viteFinal(config) {
    // Do not inherit the app's API proxy, analytics, public assets or service-worker hooks.
    return { ...config, publicDir: false }
  }
}
