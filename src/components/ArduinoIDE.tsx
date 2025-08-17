import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { CodeEditor } from '@/components/CodeEditor';
import { EnhancedSerialMonitor } from '@/components/EnhancedSerialMonitor';
import { ProjectManager } from '@/components/ProjectManager';
import { UploadInterface } from '@/components/UploadInterface';
import { fileSystemService, Project as FileProject } from '@/services/fileSystem';
import { enhancedCompiler } from '@/services/enhancedCompiler';
import { compilerService, CompileResult } from '@/services/compilerService';
import { serialService } from '@/services/serialService';
import { mobileSerialService } from '@/services/mobileSerialService';
import { realTimeCompiler } from '@/services/realTimeCompiler';
import { Device } from '@capacitor/device';
import { 
  Code, 
  Monitor, 
  FolderOpen, 
  Upload, 
  Cpu,
  Zap,
  CheckCircle2,
  WifiOff,
  AlertCircle
} from 'lucide-react';

const SAMPLE_ARDUINO_CODE = `// Arduino IDE Mobile - Blink Example
// This example code blinks the built-in LED

#define LED_PIN 13

void setup() {
  // Initialize serial communication at 9600 bits per second
  Serial.begin(9600);
  
  // Set the LED pin as an output
  pinMode(LED_PIN, OUTPUT);
  
  Serial.println("Arduino IDE Mobile - Ready!");
  Serial.println("Blink example started");
}

void loop() {
  // Turn the LED on
  digitalWrite(LED_PIN, HIGH);
  Serial.println("LED ON");
  
  // Wait for a second
  delay(1000);
  
  // Turn the LED off
  digitalWrite(LED_PIN, LOW);
  Serial.println("LED OFF");
  
  // Wait for a second
  delay(1000);
}

// Visit https://arduino.cc for more examples
// This is a basic template for Arduino projects`;

export const ArduinoIDE = () => {
  const [currentCode, setCurrentCode] = useState(SAMPLE_ARDUINO_CODE);
  const [currentProject, setCurrentProject] = useState<FileProject | undefined>();
  const [activeTab, setActiveTab] = useState('editor');
  const [isCompiling, setIsCompiling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSerialConnected, setIsSerialConnected] = useState(false);
  const [compileErrors, setCompileErrors] = useState<string[]>([]);
  const [isSerialSupported, setIsSerialSupported] = useState(false);
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [currentSerialService, setCurrentSerialService] = useState<any>(null);
  const [compilerReady, setCompilerReady] = useState(false);
  
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    const initializeSerialService = async () => {
      const deviceInfo = await Device.getInfo();
      
      if (deviceInfo.platform === 'web') {
        // Use Web Serial API for desktop browsers
        setCurrentSerialService(serialService);
        const supported = await serialService.isWebSerialSupported();
        setIsSerialSupported(supported);
      } else {
        // Use mobile serial service for iOS/Android
        setCurrentSerialService(mobileSerialService);
        const supported = await mobileSerialService.isNativeSerialSupported();
        setIsSerialSupported(supported);
      }
    };

    initializeSerialService();
    
    // Set up real-time compiler with editor
    if (editorInstance) {
      realTimeCompiler.setEditor(editorInstance);
    }
    
    return () => {
      realTimeCompiler.dispose();
    };
  }, [editorInstance]);

  useEffect(() => {
    // Monitor serial connection status for current service
    if (currentSerialService) {
      const handleSerialStatus = (message: any) => {
        if (message.type === 'info' && message.message.includes('Connected')) {
          setIsSerialConnected(true);
        } else if (message.type === 'info' && message.message.includes('Disconnected')) {
          setIsSerialConnected(false);
        }
      };
      
      currentSerialService.addMessageListener(handleSerialStatus);
      setIsSerialConnected(currentSerialService.getConnectionStatus());
      
      return () => {
        currentSerialService.removeMessageListener(handleSerialStatus);
      };
    }
  }, [currentSerialService]);

  const handleCompilerReady = (compiler: typeof enhancedCompiler) => {
    setCompilerReady(true);
  };

  useEffect(() => {
    // Always mark as having unsaved changes when code differs from saved version
    if (currentProject) {
      setHasUnsavedChanges(currentCode !== currentProject.code);
    } else {
      // If no project exists but there's code, mark as unsaved
      setHasUnsavedChanges(currentCode.trim() !== SAMPLE_ARDUINO_CODE.trim());
    }
  }, [currentCode, currentProject]);

  const handleCodeChange = useCallback((newCode: string) => {
    setCurrentCode(newCode);
    
    // Perform real-time syntax validation
    enhancedCompiler.validateSyntax(newCode).then(({ errors, warnings }) => {
      const errorMessages = errors.map(e => e.message);
      setCompileErrors(errorMessages);
      
      if (errors.length > 0) {
        // Show errors in editor via Monaco markers would be handled by realTimeCompiler
      }
    });
  }, []);

  const handleProjectSelect = async (project: FileProject) => {
    const loadedProject = await fileSystemService.loadProject(project.id);
    if (loadedProject) {
      setCurrentProject(loadedProject);
      setCurrentCode(loadedProject.code);
      setActiveTab('editor');
      setCompileErrors([]);
    }
  };

  const handleSaveProject = useCallback(async () => {
    setIsSaving(true);
    try {
      let projectToSave = currentProject;
      
      // Create a new project if none exists
      if (!projectToSave) {
        projectToSave = fileSystemService.createNewProject('Untitled Sketch', 'Arduino Uno');
        setCurrentProject(projectToSave);
      }
      
      const updatedProject = {
        ...projectToSave,
        code: currentCode,
      };
      
      await fileSystemService.saveProject(updatedProject);
      setCurrentProject(updatedProject);
      setHasUnsavedChanges(false);
      
      toast({
        title: "Project Saved",
        description: `"${updatedProject.name}" saved successfully.`,
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save the project.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [currentProject, currentCode, toast]);

  const handleCompileStart = useCallback(() => {
    setIsCompiling(true);
    setCompileErrors([]);
  }, []);

  const handleCompileComplete = useCallback((result: CompileResult) => {
    setIsCompiling(false);
    const errorMessages = result.errors.map(e => e.message);
    setCompileErrors(errorMessages);
    
    if (result.success) {
      toast({
        title: "Compilation Successful",
        description: `Code compiled successfully. Binary size: ${result.hexSize} bytes`,
      });
      // Don't automatically switch to upload tab, let user decide
    } else {
      toast({
        title: "Compilation Failed",
        description: `Found ${result.errors.length} error(s). Check the code for issues.`,
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleCompileAndUpload = async () => {
    if (!currentCode.trim()) {
      toast({
        title: "No Code",
        description: "Please write some code before compiling.",
        variant: "destructive",
      });
      return;
    }

    handleCompileStart();
    
    try {
      // First save the project if needed
      if (hasUnsavedChanges && currentProject) {
        await handleSaveProject();
      }
      
      // Use enhanced compiler with caching
      const result = await enhancedCompiler.compileWithCache(currentCode, 'uno');
      handleCompileComplete(result);
      
      // If compilation successful, switch to upload tab
      if (result.success) {
        setActiveTab('upload');
      }
    } catch (error) {
      handleCompileComplete({
        success: false,
        output: ['Compilation failed with error'],
        errors: [{ line: 1, message: 'Unexpected compilation error', type: 'error' }],
        warnings: []
      });
    }
  };

  const getConnectionStatusIcon = () => {
    if (!isSerialSupported) {
      return <AlertCircle className="h-3 w-3 mr-1" />;
    }
    return isSerialConnected ? 
      <CheckCircle2 className="h-3 w-3 mr-1" /> : 
      <WifiOff className="h-3 w-3 mr-1" />;
  };

  const getConnectionStatusText = () => {
    if (!isSerialSupported) return "Unsupported";
    return isSerialConnected ? "Connected" : "Offline";
  };

  const getConnectionStatusColor = () => {
    if (!isSerialSupported) return "bg-status-disconnected";
    return isSerialConnected ? "bg-status-connected" : "bg-secondary";
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-background">
      {/* Mobile-optimized Header */}
      <header className="bg-card border-b border-border shadow-soft">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-primary rounded-lg">
              <Cpu className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Arduino IDE Mobile</h1>
              <p className="text-xs text-muted-foreground">
                {currentProject ? currentProject.name : 'Mobile Development'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Badge 
              variant="secondary"
              className={`text-xs ${getConnectionStatusColor()}`}
            >
              {getConnectionStatusIcon()}
              {getConnectionStatusText()}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          {/* Mobile-optimized Tab Navigation */}
          <div className="bg-card border-b border-border px-2">
            <TabsList className="bg-transparent h-10 p-0 gap-0.5 w-full grid grid-cols-4">
              <TabsTrigger 
                value="editor" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs"
              >
                <Code className="h-3 w-3 mr-1" />
                Code
              </TabsTrigger>
              <TabsTrigger 
                value="projects"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs"
              >
                <FolderOpen className="h-3 w-3 mr-1" />
                Files
              </TabsTrigger>
              <TabsTrigger 
                value="upload"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs"
              >
                <Upload className="h-3 w-3 mr-1" />
                Build
              </TabsTrigger>
              <TabsTrigger 
                value="serial"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs"
              >
                <Monitor className="h-3 w-3 mr-1" />
                Serial
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            <TabsContent value="editor" className="h-full m-0">
              <div className="h-full flex flex-col">
                {/* Mobile-friendly Editor Header */}
                <div className="bg-card border-b border-border px-3 py-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">
                        {currentProject ? `${currentProject.name}.ino` : 'sketch.ino'}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        C++
                      </Badge>
                      {hasUnsavedChanges && (
                        <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                      )}
                      {compileErrors.length > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {compileErrors.length} error{compileErrors.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        size="sm"
                        onClick={handleCompileAndUpload}
                        disabled={isCompiling}
                        className="h-7 text-xs px-2"
                      >
                        <Zap className="h-3 w-3 mr-1" />
                        {isCompiling ? 'Building...' : 'Build'}
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* Monaco Code Editor with enhanced features */}
                <div className="flex-1">
                  <CodeEditor
                    value={currentCode}
                    onChange={handleCodeChange}
                    language="cpp"
                    onSave={handleSaveProject}
                    canSave={hasUnsavedChanges || currentCode.trim().length > 0}
                    isSaving={isSaving}
                    onCompilerReady={handleCompilerReady}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="projects" className="h-full m-0">
              <ProjectManager 
                onSelectProject={handleProjectSelect}
                currentProject={currentProject}
              />
            </TabsContent>

            <TabsContent value="upload" className="h-full m-0">
              <UploadInterface 
                code={currentCode}
                onCompileStart={handleCompileStart}
                onCompileComplete={handleCompileComplete}
              />
            </TabsContent>

            <TabsContent value="serial" className="h-full m-0">
              <EnhancedSerialMonitor />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Mobile Status Bar */}
      <footer className="bg-card border-t border-border px-3 py-1.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">
              {currentCode.split('\n').length} lines
            </span>
            {compileErrors.length > 0 && (
              <span className="text-destructive">
                {compileErrors.length} error{compileErrors.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              {currentProject?.board || 'Uno'}
            </span>
            <Badge variant="outline" className="text-xs">
              {isCompiling ? 'Building' : isSerialConnected ? 'Connected' : 'Ready'}
            </Badge>
          </div>
        </div>
      </footer>
    </div>
  );
};
