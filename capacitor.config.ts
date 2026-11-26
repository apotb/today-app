import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.apotb.today',
  appName: 'Today',
  webDir: 'dist',
  backgroundColor: '#f2f8f2',
  ios: {
    contentInset: 'never',
    backgroundColor: '#f2f8f2',
  },
  // The web view is capacitor://localhost. Fetch to the local HTTP API is
  // routed through the native HTTP stack so iOS does not block it as mixed content.
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
}

export default config
