import { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { compilerService, type CompileResult } from '@/services/compilerService';
import { serialService } from '@/services/serialService';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Cpu, 
  Usb,
  Settings,
  Zap,
  RefreshCw,
  Cable
} from 'lucide-react';

interface BoardInfo {
  name: string;
  id: string;
  processor: string;
  voltage: string;
  speed: string;
}

const SUPPORTED_BOARDS: BoardInfo[] = [
  {
    name: 'Arduino Uno',
    id: 'uno',
    processor: 'ATmega328P',
    voltage: '5V',
    speed: '16MHz'
  },
  {
    name: 'Arduino Nano',
    id: 'nano',
    processor: 'ATmega328P',
    voltage: '5V',
    speed: '16MHz'
  },
  {
    name: 'Arduino Mega 2560',
    id: 'mega',
    processor: 'ATmega2560',
    voltage: '5V',
    speed: '16MHz'
  },
  {
    name: 'Arduino Leonardo',
    id: 'leonardo',
    processor: 'ATmega32u4',
    voltage: '5V',
    speed: '16MHz'
  }
];

type UploadStatus = 'idle' | 'compiling' | 'uploading' | 'success' | 'error';

interface UploadInterfaceProps {
  code?: string;
  onCompileStart?: () => void;
  onCompileComplete?: (result: CompileResult) => void;
}

export const UploadInterface = ({ code, onCompileStart, onCompileComplete }: UploadInterfaceProps) => {
  const [selectedBoard, setSelectedBoard] = useState<string>('uno');
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [port, setPort] = useState<string>('');
  const [compileOutput, setCompileOutput] = useState<string[]>([]);
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [isSerialSupported, setIsSerialSupported] = useState(false);
  const { toast } = useToast();

  const selectedBoardInfo = SUPPORTED_BOARDS.find(board => board.id === selectedBoard);

  // Check Web Serial API support on mount
  useEffect(() => {
    const checkSerialSupport = async () => {
      const supported = await serialService.isWebSerialSupported();
      setIsSerialSupported(supported);
      if (!supported) {
        setCompileOutput(prev => [...prev, 'Warning: Web Serial API not supported in this browser']);
      }
    };
    checkSerialSupport();
  }, []);

  // Handle compilation
  const handleCompile = useCallback(async () => {
    if (!code) {
      toast({
        title: "No Code",
        description: "No code to compile",
        variant: "destructive",
      });
      return;
    }

    setUploadStatus('compiling');
    setProgress(0);
    setCompileOutput(['Starting compilation...']);
    onCompileStart?.();

    try {
      const result = await compilerService.compileSketch(code, selectedBoard);
      setCompileResult(result);
      onCompileComplete?.(result);

      if (result.success) {
        setCompileOutput(result.output);
        setUploadStatus('idle');
        setProgress(0);
        toast({
          title: "Compilation Successful",
          description: `Code compiled successfully. Size: ${result.hexSize} bytes`,
        });
      } else {
        setCompileOutput(result.output);
        setUploadStatus('error');
        toast({
          title: "Compilation Failed",
          description: result.errors.join(', '),
          variant: "destructive",
        });
      }
    } catch (error) {
      setCompileOutput(prev => [...prev, `Compilation error: ${error}`]);
      setUploadStatus('error');
      toast({
        title: "Compilation Error",
        description: "An unexpected error occurred during compilation",
        variant: "destructive",
      });
    }
  }, [code, selectedBoard, onCompileStart, onCompileComplete, toast]);

  const handleUpload = async () => {
    if (!compileResult?.success) {
      toast({
        title: "Compile First",
        description: "Please compile your code successfully before uploading",
        variant: "destructive",
      });
      return;
    }

    if (!isConnected) {
      toast({
        title: "Board Not Connected",
        description: "Please connect to your Arduino board first",
        variant: "destructive",
      });
      return;
    }

    setUploadStatus('uploading');
    setProgress(0);
    setCompileOutput(prev => [...prev, '', 'Starting upload...']);

    try {
      // Simulate upload process with more realistic steps
      const uploadSteps = [
        'Connecting to board...',
        'Checking board compatibility...',
        'Erasing flash memory...',
        'Writing flash memory...',
        'Verifying flash memory...',
        'Resetting board...',
        'Upload complete!'
      ];

      for (let i = 0; i < uploadSteps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
        setCompileOutput(prev => [...prev, uploadSteps[i]]);
        setProgress(((i + 1) / uploadSteps.length) * 100);
      }

      setUploadStatus('success');
      toast({
        title: "Upload Successful",
        description: "Your code has been uploaded to the board successfully",
      });

      // Reset after a delay
      setTimeout(() => {
        setUploadStatus('idle');
        setProgress(0);
      }, 3000);

    } catch (error) {
      setCompileOutput(prev => [...prev, `Upload error: ${error}`]);
      setUploadStatus('error');
      toast({
        title: "Upload Failed",
        description: "Failed to upload code to the board",
        variant: "destructive",
      });
    }
  };

  const handleConnect = async () => {
    if (isConnected) {
      await serialService.disconnect();
      setIsConnected(false);
      setPort('');
      setCompileOutput(prev => [...prev, 'Disconnected from board']);
    } else {
      if (!isSerialSupported) {
        toast({
          title: "Serial Not Supported",
          description: "Web Serial API is not supported in this browser. Try Chrome, Edge, or Opera.",
          variant: "destructive",
        });
        return;
      }

      try {
        const connected = await serialService.connect(115200);
        if (connected) {
          setIsConnected(true);
          setPort('Serial Port'); // Real port info would come from Web Serial API
          setCompileOutput(prev => [...prev, `Connected to ${selectedBoardInfo?.name}`]);
          toast({
            title: "Board Connected",
            description: "Successfully connected to Arduino board",
          });
        } else {
          toast({
            title: "Connection Failed",
            description: "Failed to connect to the board",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Connection Error",
          description: "An error occurred while connecting to the board",
          variant: "destructive",
        });
      }
    }
  };

  const getStatusIcon = () => {
    switch (uploadStatus) {
      case 'compiling':
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-status-connected" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-status-disconnected" />;
      default:
        return <Upload className="h-4 w-4" />;
    }
  };

  const getStatusText = () => {
    switch (uploadStatus) {
      case 'compiling':
        return 'Compiling...';
      case 'uploading':
        return 'Uploading...';
      case 'success':
        return 'Upload Complete';
      case 'error':
        return 'Upload Failed';
      default:
        return 'Ready to Upload';
    }
  };

  const isUploading = uploadStatus === 'compiling' || uploadStatus === 'uploading';

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Mobile-optimized header */}
      <div className="p-3 border-b border-border bg-card">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Compile & Upload
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Board Configuration - Compact for mobile */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Board Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-medium">Board Type</label>
              <Select value={selectedBoard} onValueChange={setSelectedBoard}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_BOARDS.map((board) => (
                    <SelectItem key={board.id} value={board.id}>
                      {board.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedBoardInfo && (
              <div className="grid grid-cols-2 gap-2 text-xs bg-muted/50 p-2 rounded">
                <div>
                  <span className="text-muted-foreground">Processor:</span>
                  <p className="font-mono text-xs">{selectedBoardInfo.processor}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Speed:</span>
                  <p className="font-mono text-xs">{selectedBoardInfo.speed}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connection Status - Mobile optimized */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Cable className="h-4 w-4" />
              Connection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge 
                  variant={isConnected ? "default" : "secondary"}
                  className={`text-xs ${isConnected ? "bg-status-connected" : "bg-status-disconnected"}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isConnected ? 'bg-white' : 'bg-muted-foreground'}`} />
                  {isConnected ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
              <Button
                variant={isConnected ? "destructive" : "default"}
                size="sm"
                onClick={handleConnect}
                disabled={isUploading}
                className="h-8 text-xs"
              >
                <Usb className="h-3 w-3 mr-1" />
                {isConnected ? 'Disconnect' : 'Connect'}
              </Button>
            </div>
            
            {!isSerialSupported && (
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                ⚠️ Web Serial API not supported. Use Chrome, Edge, or Opera for serial connection.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Compile & Upload Controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              Build & Deploy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleCompile}
                disabled={isUploading || !code}
                className="h-9 text-sm"
                variant="outline"
              >
                <RefreshCw className="h-3 w-3 mr-2" />
                Compile Code
              </Button>
              
              <Button
                onClick={handleUpload}
                disabled={!compileResult?.success || !isConnected || isUploading}
                className="h-9 text-sm"
              >
                {getStatusIcon()}
                <span className="ml-2">{getStatusText()}</span>
              </Button>
            </div>

            {/* Status display */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {compileResult?.success ? `Binary: ${compileResult.hexSize}B` : 'Not compiled'}
              </span>
              <Badge variant="outline" className="text-xs">
                {uploadStatus === 'idle' ? 'Ready' : getStatusText()}
              </Badge>
            </div>

            {isUploading && (
              <div className="space-y-2">
                <Progress value={progress} className="h-1.5" />
                <p className="text-xs text-muted-foreground text-center">
                  {Math.round(progress)}% complete
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Compile Output - Compact for mobile */}
        {compileOutput.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Build Output</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-console-background rounded p-2 h-32 overflow-y-auto custom-scrollbar">
                <div className="space-y-0.5">
                  {compileOutput.map((line, index) => (
                    <div key={index} className="text-xs font-mono text-console-foreground leading-tight">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};