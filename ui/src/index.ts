import { definePlugin } from '@halo-dev/ui-shared'

export default definePlugin({
  components: {},
  extensionPoints: {
    'default:editor:extension:create': async () => {
      const { ExtensionVolcano } = await import('./editor/volcano')
      return [ExtensionVolcano]
    },
  },
})
