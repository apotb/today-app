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
  // Debug runs in Xcode load the Vite server instead (scripts/ios-live-reload.py).
  // A bundled build uses capacitor://localhost, so CapacitorHttp carries API calls.
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
}

export default config
