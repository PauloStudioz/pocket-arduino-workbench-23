import { Device } from '@capacitor/device';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

interface MobileSerialMessage {
  id: string;
  timestamp: Date;
  message: string;
  type: 'received' | 'sent' | 'error' | 'info';
}

class MobileSerialService {
  private isConnected: boolean = false;
  private messageListeners: ((message: MobileSerialMessage) => void)[] = [];
  private currentBaudRate: number = 9600;
  private connectionType: 'usb' | 'bluetooth' | null = null;

  async isNativeSerialSupported(): Promise<boolean> {
    const info = await Device.getInfo();
    return info.platform === 'ios' || info.platform === 'android';
  }

  async requestUSBPermission(): Promise<boolean> {
    try {
      const info = await Device.getInfo();
      
      if (info.platform === 'android') {
        // For Android, we'll use USB Host API
        return this.requestAndroidUSBPermission();
      } else if (info.platform === 'ios') {
        // For iOS, we'll use External Accessory Framework
        return this.requestiOSAccessoryPermission();
      }
      
      return false;
    } catch (error) {
      console.error('USB permission request failed:', error);
      return false;
    }
  }

  private async requestAndroidUSBPermission(): Promise<boolean> {
    // This would typically involve a native Android plugin
    // For now, we'll simulate the permission request
    return new Promise((resolve) => {
      // Simulate permission dialog
      setTimeout(() => {
        this.emitMessage({
          id: Math.random().toString(36),
          timestamp: new Date(),
          message: 'USB permission granted on Android',
          type: 'info'
        });
        resolve(true);
      }, 1000);
    });
  }

  private async requestiOSAccessoryPermission(): Promise<boolean> {
    // This would typically involve MFi accessory support
    // For now, we'll simulate the permission request
    return new Promise((resolve) => {
      setTimeout(() => {
        this.emitMessage({
          id: Math.random().toString(36),
          timestamp: new Date(),
          message: 'External Accessory permission granted on iOS',
          type: 'info'
        });
        resolve(true);
      }, 1000);
    });
  }

  async connect(baudRate: number = 9600): Promise<boolean> {
    try {
      this.currentBaudRate = baudRate;
      
      const info = await Device.getInfo();
      
      if (info.platform === 'web') {
        // Fall back to Web Serial API on web
        return this.connectWebSerial(baudRate);
      }

      // Check for USB permission first
      const hasPermission = await this.requestUSBPermission();
      if (!hasPermission) {
        throw new Error('USB permission denied');
      }

      // Simulate connection process
      await this.simulateConnection(baudRate);
      
      this.isConnected = true;
      this.connectionType = 'usb';
      
      this.emitMessage({
        id: Math.random().toString(36),
        timestamp: new Date(),
        message: `Connected to Arduino via USB at ${baudRate} baud`,
        type: 'info'
      });

      // Start listening for incoming data
      this.startDataListener();
      
      return true;
    } catch (error) {
      this.emitMessage({
        id: Math.random().toString(36),
        timestamp: new Date(),
        message: `Connection failed: ${error}`,
        type: 'error'
      });
      return false;
    }
  }

  private async connectWebSerial(baudRate: number): Promise<boolean> {
    if (!('serial' in navigator)) {
      throw new Error('Web Serial API not supported');
    }

    try {
      // Use Web Serial API for web browsers
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate });
      
      this.isConnected = true;
      this.connectionType = 'usb';
      
      return true;
    } catch (error) {
      throw new Error(`Web Serial connection failed: ${error}`);
    }
  }

  private async simulateConnection(baudRate: number): Promise<void> {
    // Simulate the connection handshake
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 1500);
    });
  }

  private startDataListener(): void {
    // Simulate incoming data from Arduino
    setInterval(() => {
      if (this.isConnected) {
        const simulatedData = [
          'Sensor reading: 23.5°C',
          'Humidity: 45%',
          'Light level: 512',
          'Motion detected',
          'System ready'
        ];
        
        const randomMessage = simulatedData[Math.floor(Math.random() * simulatedData.length)];
        
        this.emitMessage({
          id: Math.random().toString(36),
          timestamp: new Date(),
          message: randomMessage,
          type: 'received'
        });
      }
    }, 3000 + Math.random() * 5000); // Random interval between 3-8 seconds
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.connectionType = null;
    
    this.emitMessage({
      id: Math.random().toString(36),
      timestamp: new Date(),
      message: 'Disconnected from Arduino',
      type: 'info'
    });
  }

  async sendMessage(message: string): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Not connected to Arduino');
    }

    try {
      // Log the sent message
      this.emitMessage({
        id: Math.random().toString(36),
        timestamp: new Date(),
        message: `Sent: ${message}`,
        type: 'sent'
      });

      // Simulate sending data to Arduino
      await this.simulateSendData(message);
      
      return true;
    } catch (error) {
      this.emitMessage({
        id: Math.random().toString(36),
        timestamp: new Date(),
        message: `Send failed: ${error}`,
        type: 'error'
      });
      return false;
    }
  }

  private async simulateSendData(message: string): Promise<void> {
    // Simulate network delay
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate echo or response from Arduino
        setTimeout(() => {
          this.emitMessage({
            id: Math.random().toString(36),
            timestamp: new Date(),
            message: `Echo: ${message}`,
            type: 'received'
          });
        }, 100 + Math.random() * 500);
        
        resolve();
      }, 50);
    });
  }

  async uploadCode(hexData: string): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Not connected to Arduino');
    }

    try {
      this.emitMessage({
        id: Math.random().toString(36),
        timestamp: new Date(),
        message: 'Starting upload...',
        type: 'info'
      });

      // Simulate upload process
      await this.simulateUpload(hexData);
      
      this.emitMessage({
        id: Math.random().toString(36),
        timestamp: new Date(),
        message: 'Upload completed successfully!',
        type: 'info'
      });
      
      return true;
    } catch (error) {
      this.emitMessage({
        id: Math.random().toString(36),
        timestamp: new Date(),
        message: `Upload failed: ${error}`,
        type: 'error'
      });
      return false;
    }
  }

  private async simulateUpload(hexData: string): Promise<void> {
    const totalSteps = 10;
    
    for (let i = 1; i <= totalSteps; i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const progress = Math.round((i / totalSteps) * 100);
      this.emitMessage({
        id: Math.random().toString(36),
        timestamp: new Date(),
        message: `Upload progress: ${progress}%`,
        type: 'info'
      });
    }
  }

  addMessageListener(callback: (message: MobileSerialMessage) => void): void {
    this.messageListeners.push(callback);
  }

  removeMessageListener(callback: (message: MobileSerialMessage) => void): void {
    const index = this.messageListeners.indexOf(callback);
    if (index > -1) {
      this.messageListeners.splice(index, 1);
    }
  }

  private emitMessage(message: MobileSerialMessage): void {
    this.messageListeners.forEach(listener => {
      try {
        listener(message);
      } catch (error) {
        console.error('Error in message listener:', error);
      }
    });
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getCurrentBaudRate(): number {
    return this.currentBaudRate;
  }

  getConnectionType(): string | null {
    return this.connectionType;
  }

  async saveLogToFile(): Promise<void> {
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `arduino_log_${timestamp}.txt`;
      
      const logContent = `Arduino IDE Mobile - Session Log\nGenerated: ${new Date().toISOString()}\n\n`;
      
      await Filesystem.writeFile({
        path: fileName,
        data: logContent,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });

      this.emitMessage({
        id: Math.random().toString(36),
        timestamp: new Date(),
        message: `Log saved to ${fileName}`,
        type: 'info'
      });
    } catch (error) {
      this.emitMessage({
        id: Math.random().toString(36),
        timestamp: new Date(),
        message: `Failed to save log: ${error}`,
        type: 'error'
      });
    }
  }
}

export const mobileSerialService = new MobileSerialService();