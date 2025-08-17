// Offline storage service for Arduino projects and examples
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface ArduinoProject {
  id: string;
  name: string;
  code: string;
  description?: string;
  board: string;
  createdAt: Date;
  updatedAt: Date;
  isExample?: boolean;
}

interface ArduinoLibrary {
  id: string;
  name: string;
  version: string;
  code: string;
  examples: string[];
  documentation?: string;
}

interface CompileCache {
  id: string;
  codeHash: string;
  board: string;
  hexData: Uint8Array;
  errors: any[];
  timestamp: Date;
}

interface ArduinoDBSchema extends DBSchema {
  projects: {
    key: string;
    value: ArduinoProject;
    indexes: { 'by-name': string; 'by-board': string };
  };
  libraries: {
    key: string;
    value: ArduinoLibrary;
    indexes: { 'by-name': string };
  };
  compileCache: {
    key: string;
    value: CompileCache;
    indexes: { 'by-hash': string };
  };
}

class OfflineStorageService {
  private db: IDBPDatabase<ArduinoDBSchema> | null = null;

  async init(): Promise<void> {
    this.db = await openDB<ArduinoDBSchema>('ArduinoIDE', 1, {
      upgrade(db) {
        // Projects store
        const projectStore = db.createObjectStore('projects', {
          keyPath: 'id'
        });
        projectStore.createIndex('by-name', 'name');
        projectStore.createIndex('by-board', 'board');

        // Libraries store
        const libraryStore = db.createObjectStore('libraries', {
          keyPath: 'id'
        });
        libraryStore.createIndex('by-name', 'name');

        // Compile cache store
        const cacheStore = db.createObjectStore('compileCache', {
          keyPath: 'id'
        });
        cacheStore.createIndex('by-hash', 'codeHash');
      }
    });

    // Initialize with default examples
    await this.initializeExamples();
  }

  // Project management
  async saveProject(project: Omit<ArduinoProject, 'id' | 'createdAt' | 'updatedAt'>): Promise<ArduinoProject> {
    if (!this.db) throw new Error('Database not initialized');

    const id = crypto.randomUUID();
    const now = new Date();
    const fullProject: ArduinoProject = {
      ...project,
      id,
      createdAt: now,
      updatedAt: now
    };

    await this.db.put('projects', fullProject);
    return fullProject;
  }

  async updateProject(id: string, updates: Partial<ArduinoProject>): Promise<ArduinoProject> {
    if (!this.db) throw new Error('Database not initialized');

    const existing = await this.db.get('projects', id);
    if (!existing) throw new Error('Project not found');

    const updated: ArduinoProject = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    await this.db.put('projects', updated);
    return updated;
  }

  async getProject(id: string): Promise<ArduinoProject | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.get('projects', id);
  }

  async getAllProjects(): Promise<ArduinoProject[]> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.getAll('projects');
  }

  async deleteProject(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.delete('projects', id);
  }

  // Library management
  async saveLibrary(library: Omit<ArduinoLibrary, 'id'>): Promise<ArduinoLibrary> {
    if (!this.db) throw new Error('Database not initialized');

    const id = crypto.randomUUID();
    const fullLibrary: ArduinoLibrary = { ...library, id };

    await this.db.put('libraries', fullLibrary);
    return fullLibrary;
  }

  async getLibrary(name: string): Promise<ArduinoLibrary | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.getFromIndex('libraries', 'by-name', name);
  }

  async getAllLibraries(): Promise<ArduinoLibrary[]> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.getAll('libraries');
  }

  // Compile cache management
  async cacheCompileResult(codeHash: string, board: string, hexData: Uint8Array, errors: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const cache: CompileCache = {
      id: `${codeHash}-${board}`,
      codeHash,
      board,
      hexData,
      errors,
      timestamp: new Date()
    };

    await this.db.put('compileCache', cache);
  }

  async getCachedCompileResult(codeHash: string, board: string): Promise<CompileCache | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.get('compileCache', `${codeHash}-${board}`);
  }

  async clearOldCache(olderThanDays: number = 7): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const allCache = await this.db.getAll('compileCache');
    const toDelete = allCache.filter(cache => cache.timestamp < cutoffDate);

    for (const cache of toDelete) {
      await this.db.delete('compileCache', cache.id);
    }
  }

  // Utility functions
  async exportProject(id: string): Promise<string> {
    const project = await this.getProject(id);
    if (!project) throw new Error('Project not found');

    return JSON.stringify(project, null, 2);
  }

  async importProject(projectData: string): Promise<ArduinoProject> {
    const parsed = JSON.parse(projectData);
    return this.saveProject({
      name: parsed.name || 'Imported Project',
      code: parsed.code || '',
      description: parsed.description,
      board: parsed.board || 'uno'
    });
  }

  private async initializeExamples(): Promise<void> {
    const examples = await this.getAllProjects();
    if (examples.some(p => p.isExample)) return; // Examples already exist

    const defaultExamples: Omit<ArduinoProject, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'Blink LED',
        code: `// Blink LED Example
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}`,
        description: 'Basic LED blinking example',
        board: 'uno',
        isExample: true
      },
      {
        name: 'Serial Communication',
        code: `// Serial Communication Example
void setup() {
  Serial.begin(9600);
  Serial.println("Arduino Serial Monitor Ready!");
}

void loop() {
  if (Serial.available() > 0) {
    String receivedData = Serial.readString();
    Serial.print("You sent: ");
    Serial.println(receivedData);
  }
  
  Serial.print("Uptime: ");
  Serial.print(millis() / 1000);
  Serial.println(" seconds");
  delay(2000);
}`,
        description: 'Serial communication example with echo',
        board: 'uno',
        isExample: true
      },
      {
        name: 'Analog Read',
        code: `// Analog Read Example
void setup() {
  Serial.begin(9600);
}

void loop() {
  int sensorValue = analogRead(A0);
  float voltage = sensorValue * (5.0 / 1023.0);
  
  Serial.print("Sensor Value: ");
  Serial.print(sensorValue);
  Serial.print(" | Voltage: ");
  Serial.print(voltage);
  Serial.println("V");
  
  delay(500);
}`,
        description: 'Read analog sensor values',
        board: 'uno',
        isExample: true
      }
    ];

    for (const example of defaultExamples) {
      await this.saveProject(example);
    }
  }
}

export const offlineStorage = new OfflineStorageService();