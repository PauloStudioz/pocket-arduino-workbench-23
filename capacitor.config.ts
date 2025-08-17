import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.a2b62e02c76345818f810425e4c9ddc1',
  appName: 'Arduino IDE Mobile',
  webDir: 'dist',
  server: {
    url: 'https://qrdmeckbwlzctyirgsaf.supabase.co',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: "#1a1a1f",
      showSpinner: false
    }
  }
};

export default config;
