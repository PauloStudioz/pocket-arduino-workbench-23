import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface Project {
  id: string;
  name: string;
  description: string;
  code: string;
  lastModified: Date;
  size: string;
  board: string;
}

interface ProjectDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
  };
}

class FileSystemService {
  private db: IDBPDatabase<ProjectDB> | null = null;

  async init() {
    if (!this.db) {
      this.db = await openDB<ProjectDB>('arduino-projects', 1, {
        upgrade(db) {
          db.createObjectStore('projects', { keyPath: 'id' });
        },
      });
    }
    return this.db;
  }

  async saveProject(project: Project): Promise<void> {
    const db = await this.init();
    await db.put('projects', {
      ...project,
      lastModified: new Date(),
      size: `${Math.round(project.code.length / 1024 * 100) / 100} KB`,
    });
  }

  async loadProject(id: string): Promise<Project | undefined> {
    const db = await this.init();
    return await db.get('projects', id);
  }

  async getAllProjects(): Promise<Project[]> {
    const db = await this.init();
    return await db.getAll('projects');
  }

  async deleteProject(id: string): Promise<void> {
    const db = await this.init();
    await db.delete('projects', id);
  }

  async duplicateProject(id: string): Promise<Project | null> {
    const original = await this.loadProject(id);
    if (!original) return null;

    const duplicate: Project = {
      ...original,
      id: Date.now().toString(),
      name: `${original.name} (Copy)`,
      lastModified: new Date(),
    };

    await this.saveProject(duplicate);
    return duplicate;
  }

  async importProject(file: File): Promise<Project> {
    const content = await file.text();
    const project: Project = {
      id: Date.now().toString(),
      name: file.name.replace('.ino', ''),
      description: 'Imported project',
      code: content,
      lastModified: new Date(),
      size: `${Math.round(file.size / 1024 * 100) / 100} KB`,
      board: 'Arduino Uno',
    };

    await this.saveProject(project);
    return project;
  }

  async exportProject(project: Project): Promise<void> {
    const blob = new Blob([project.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}.ino`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  createNewProject(name: string = 'New Project', board: string = 'Arduino Uno'): Project {
    const defaultCode = `// ${name}
// Created on ${new Date().toLocaleDateString()}

void setup() {
  // Initialize serial communication
  Serial.begin(9600);
  
  // Your setup code here
}

void loop() {
  // Your main code here
}`;

    return {
      id: Date.now().toString(),
      name,
      description: 'A new Arduino project',
      code: defaultCode,
      lastModified: new Date(),
      size: `${Math.round(defaultCode.length / 1024 * 100) / 100} KB`,
      board,
    };
  }
}

export const fileSystemService = new FileSystemService();
export type { Project };