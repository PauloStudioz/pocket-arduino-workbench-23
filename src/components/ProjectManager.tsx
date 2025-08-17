import { useState, useEffect } from 'react';
import { Search, Plus, Download, Upload, Copy, Trash2, FolderOpen } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { fileSystemService, Project } from '@/services/fileSystem';
import { useToast } from '@/hooks/use-toast';

interface ProjectManagerProps {
  onSelectProject: (project: Project) => void;
  currentProject?: Project;
}

export const ProjectManager = ({ onSelectProject, currentProject }: ProjectManagerProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const loadedProjects = await fileSystemService.getAllProjects();
      setProjects(loadedProjects);
      
      if (loadedProjects.length === 0) {
        await createSampleProjects();
      }
    } catch (error) {
      toast({
        title: "Error Loading Projects",
        description: "Failed to load projects from storage.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createSampleProjects = async () => {
    const samples = [
      {
        name: "Blink LED",
        description: "Basic LED blinking example for beginners",
        board: "Arduino Uno",
        code: `void setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(1000);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(1000);\n}`
      }
    ];

    for (const sample of samples) {
      const project = fileSystemService.createNewProject(sample.name, sample.board);
      project.description = sample.description;
      project.code = sample.code;
      await fileSystemService.saveProject(project);
    }
    
    await loadProjects();
  };

  const handleCreateProject = async () => {
    const project = fileSystemService.createNewProject();
    await fileSystemService.saveProject(project);
    await loadProjects();
    onSelectProject(project);
    
    toast({
      title: "Project Created",
      description: `New project "${project.name}" created successfully.`,
    });
  };

  const handleImportProject = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ino,.cpp,.c';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const project = await fileSystemService.importProject(file);
          await loadProjects();
          toast({
            title: "Project Imported",
            description: `"${project.name}" imported successfully.`,
          });
        } catch (error) {
          toast({
            title: "Import Failed",
            description: "Failed to import the selected file.",
            variant: "destructive",
          });
        }
      }
    };
    input.click();
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.board.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Projects</h2>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreateProject}>
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
            <Button variant="outline" size="sm" onClick={handleImportProject}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </div>
        </div>
        <Input
          placeholder="Search projects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading projects...</p>
            </div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Projects Found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'No projects match your search.' : 'Create your first Arduino project to get started.'}
            </p>
            <Button onClick={handleCreateProject}>
              <Plus className="h-4 w-4 mr-2" />
              Create New Project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <Card 
                key={project.id} 
                className="p-4 hover:shadow-md transition-shadow cursor-pointer border border-border"
                onClick={() => onSelectProject(project)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1 truncate">{project.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
                  </div>
                  <Badge variant="outline" className="ml-2 text-xs shrink-0">
                    {project.board}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <span>{formatRelativeTime(project.lastModified)}</span>
                  <span>{project.size}</span>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const duplicate = await fileSystemService.duplicateProject(project.id);
                      if (duplicate) await loadProjects();
                    }}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Duplicate
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileSystemService.exportProject(project);
                    }}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await fileSystemService.deleteProject(project.id);
                      await loadProjects();
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};