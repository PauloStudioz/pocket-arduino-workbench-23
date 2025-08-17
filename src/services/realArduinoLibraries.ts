interface ArduinoLibrary {
  name: string;
  version: string;
  author: string;
  description: string;
  includes: string[];
  dependencies: string[];
  categories: string[];
  examples: string[];
  installed: boolean;
}

class RealArduinoLibrariesService {
  private readonly baseUrl = 'https://qrdmeckbwlzctyirgsaf.supabase.co/functions/v1/arduino-libraries';
  private readonly headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyZG1lY2tid2x6Y3R5aXJnc2FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0MTE1MjIsImV4cCI6MjA3MDk4NzUyMn0.7O7bopvIUT4cKCwO-IW38IuZw8ILDCGoYlLKp5LWCE0`
  };

  async getLibraries(category?: string, installedOnly?: boolean): Promise<ArduinoLibrary[]> {
    try {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (installedOnly !== undefined) params.append('installed', installedOnly.toString());

      const response = await fetch(`${this.baseUrl}/list?${params}`, {
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch libraries: ${response.statusText}`);
      }

      const data = await response.json();
      return data.libraries;
    } catch (error) {
      console.error('Failed to fetch Arduino libraries:', error);
      return this.getFallbackLibraries();
    }
  }

  async searchLibraries(query: string): Promise<ArduinoLibrary[]> {
    try {
      const response = await fetch(`${this.baseUrl}/search?q=${encodeURIComponent(query)}`, {
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`Failed to search libraries: ${response.statusText}`);
      }

      const data = await response.json();
      return data.libraries;
    } catch (error) {
      console.error('Failed to search Arduino libraries:', error);
      return [];
    }
  }

  async installLibrary(name: string, version?: string): Promise<{ success: boolean; message: string; library?: ArduinoLibrary }> {
    try {
      const response = await fetch(`${this.baseUrl}/install`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ name, version })
      });

      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          message: data.error || 'Installation failed'
        };
      }

      return {
        success: true,
        message: data.message,
        library: data.library
      };
    } catch (error) {
      console.error('Failed to install Arduino library:', error);
      return {
        success: false,
        message: `Installation failed: ${error}`
      };
    }
  }

  async uninstallLibrary(name: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/uninstall`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ name })
      });

      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          message: data.error || 'Uninstallation failed'
        };
      }

      return {
        success: true,
        message: data.message
      };
    } catch (error) {
      console.error('Failed to uninstall Arduino library:', error);
      return {
        success: false,
        message: `Uninstallation failed: ${error}`
      };
    }
  }

  async getLibraryInfo(name: string): Promise<ArduinoLibrary | null> {
    try {
      const response = await fetch(`${this.baseUrl}/info?name=${encodeURIComponent(name)}`, {
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`Failed to get library info: ${response.statusText}`);
      }

      const data = await response.json();
      return data.library;
    } catch (error) {
      console.error('Failed to get Arduino library info:', error);
      return null;
    }
  }

  async getLibraryExamples(name: string): Promise<{ name: string; code: string }[]> {
    try {
      const response = await fetch(`${this.baseUrl}/examples?name=${encodeURIComponent(name)}`, {
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`Failed to get library examples: ${response.statusText}`);
      }

      const data = await response.json();
      return data.examples;
    } catch (error) {
      console.error('Failed to get Arduino library examples:', error);
      return [];
    }
  }

  getCategories(): string[] {
    return [
      'Communication',
      'Display', 
      'Sensors',
      'Device Control',
      'Data Storage',
      'Timing',
      'Signal Input/Output',
      'Uncategorized'
    ];
  }

  private getFallbackLibraries(): ArduinoLibrary[] {
    // Fallback libraries when backend is not available
    return [
      {
        name: "Servo",
        version: "1.2.1",
        author: "Arduino",
        description: "Allows Arduino boards to control a variety of servo motors.",
        includes: ["Servo.h"],
        dependencies: [],
        categories: ["Device Control"],
        examples: ["Knob", "Sweep"],
        installed: true
      },
      {
        name: "LiquidCrystal",
        version: "1.0.7", 
        author: "Arduino",
        description: "Allows communication with alphanumeric liquid crystal displays (LCDs).",
        includes: ["LiquidCrystal.h"],
        dependencies: [],
        categories: ["Display"],
        examples: ["HelloWorld", "Blink"],
        installed: true
      },
      {
        name: "SoftwareSerial",
        version: "1.0",
        author: "Arduino",
        description: "Multi-instance software serial library for Arduino",
        includes: ["SoftwareSerial.h"], 
        dependencies: [],
        categories: ["Communication"],
        examples: ["SoftwareSerialExample"],
        installed: true
      }
    ];
  }

  async validateLibraryIncludes(code: string): Promise<{ missing: string[]; suggestions: ArduinoLibrary[] }> {
    const includeMatches = code.match(/#include\s*<(.+?)>/g) || [];
    const includes = includeMatches.map(match => match.match(/#include\s*<(.+?)>/)?.[1] || '');
    
    const allLibraries = await this.getLibraries();
    const installedLibraries = allLibraries.filter(lib => lib.installed);
    
    const missing: string[] = [];
    const suggestions: ArduinoLibrary[] = [];
    
    for (const include of includes) {
      if (!include) continue;
      
      const isAvailable = installedLibraries.some(lib => 
        lib.includes.includes(include)
      );
      
      if (!isAvailable) {
        missing.push(include);
        
        // Find suggested libraries that provide this include
        const suggestedLibs = allLibraries.filter(lib => 
          lib.includes.includes(include) && !lib.installed
        );
        suggestions.push(...suggestedLibs);
      }
    }
    
    return { missing, suggestions };
  }
}

export const realArduinoLibraries = new RealArduinoLibrariesService();
export type { ArduinoLibrary };