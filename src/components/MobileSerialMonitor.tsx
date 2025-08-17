import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Monitor, 
  Send, 
  Trash2, 
  Download, 
  Upload,
  Wifi,
  WifiOff,
  Settings,
  ZapOff,
  RefreshCw,
  Copy,
  Share
} from 'lucide-react';
import { serialService, SerialMessage } from '@/services/serialService';

const MobileSerialMonitor = () => {
  const [messages, setMessages] = useState<SerialMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [baudRate, setBaudRate] = useState(9600);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState('');
  const [showTimestamps, setShowTimestamps] = useState(true);
  const { toast } = useToast();

  const commonBaudRates = [9600, 19200, 38400, 57600, 115200];
  const quickCommands = [
    { label: 'AT', command: 'AT' },
    { label: 'Reset', command: 'RST' },
    { label: 'Help', command: '?' },
    { label: 'Status', command: 'STATUS' },
  ];

  useEffect(() => {
    const handleMessage = (message: SerialMessage) => {
      setMessages(prev => {
        const newMessages = [...prev, message];
        // Keep only last 1000 messages for performance
        return newMessages.slice(-1000);
      });
    };

    serialService.addMessageListener(handleMessage);
    setIsConnected(serialService.getConnectionStatus());

    return () => {
      serialService.removeMessageListener(handleMessage);
    };
  }, []);

  const handleConnect = async () => {
    if (isConnected) {
      await serialService.disconnect();
      setIsConnected(false);
      toast({
        title: "Disconnected",
        description: "Serial connection closed.",
      });
    } else {
      const connected = await serialService.connect(baudRate);
      setIsConnected(connected);
      if (connected) {
        toast({
          title: "✓ Connected",
          description: `Connected at ${baudRate} baud.`,
        });
      } else {
        toast({
          title: "❌ Connection Failed",
          description: "Please check your device and permissions.",
          variant: "destructive",
        });
      }
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !isConnected) return;
    
    const success = await serialService.sendMessage(inputMessage.trim());
    if (success) {
      setInputMessage('');
    } else {
      toast({
        title: "Send Failed",
        description: "Failed to send message. Check connection.",
        variant: "destructive",
      });
    }
  };

  const handleQuickCommand = async (command: string) => {
    if (!isConnected) return;
    await serialService.sendMessage(command);
  };

  const clearMessages = () => {
    setMessages([]);
    toast({
      title: "Cleared",
      description: "Serial monitor cleared.",
    });
  };

  const exportMessages = () => {
    const exportData = messages.map(msg => 
      `[${msg.timestamp.toISOString()}] ${msg.type.toUpperCase()}: ${msg.message}`
    ).join('\n');
    
    const blob = new Blob([exportData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `serial_log_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = () => {
    const text = messages.map(msg => msg.message).join('\n');
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Messages copied to clipboard.",
    });
  };

  const filteredMessages = messages.filter(msg => 
    !filter || msg.message.toLowerCase().includes(filter.toLowerCase())
  );

  const getMessageStyle = (type: SerialMessage['type']) => {
    switch (type) {
      case 'sent': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'received': return 'text-green-600 bg-green-50 border-green-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'info': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-foreground bg-background border-border';
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Mobile Header */}
      <div className="flex flex-col gap-2 p-3 bg-card border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            <h2 className="font-semibold text-lg">Serial Monitor</h2>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"} className="text-xs">
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3 mr-1" />
                Connected
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 mr-1" />
                Disconnected
              </>
            )}
          </Badge>
        </div>

        {/* Connection Controls */}
        <div className="flex items-center gap-2">
          <select
            value={baudRate}
            onChange={(e) => setBaudRate(Number(e.target.value))}
            disabled={isConnected}
            className="px-2 py-1 text-sm bg-background border border-border rounded"
          >
            {commonBaudRates.map(rate => (
              <option key={rate} value={rate}>{rate} baud</option>
            ))}
          </select>
          
          <Button
            onClick={handleConnect}
            size="sm"
            variant={isConnected ? "destructive" : "default"}
            className="flex-1"
          >
            {isConnected ? (
              <>
                <ZapOff className="h-3 w-3 mr-1" />
                Disconnect
              </>
            ) : (
              <>
                <Wifi className="h-3 w-3 mr-1" />
                Connect
              </>
            )}
          </Button>
        </div>

        {/* Filter and Controls */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="Filter messages..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 h-8 text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={clearMessages}
            className="h-8 px-2"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportMessages}
            className="h-8 px-2"
          >
            <Download className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={copyToClipboard}
            className="h-8 px-2"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Messages Display */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-3 space-y-2">
            {filteredMessages.length > 0 ? (
              filteredMessages.map((message) => (
                <div
                  key={message.id}
                  className={`p-2 rounded-lg text-sm border ${getMessageStyle(message.type)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 font-mono break-all">
                      {message.message}
                    </div>
                    {showTimestamps && (
                      <div className="text-xs opacity-60 whitespace-nowrap">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <Monitor className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs">Connect to start monitoring serial communication</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Quick Commands */}
      <div className="p-2 bg-card border-t border-border">
        <div className="grid grid-cols-4 gap-1 mb-2">
          {quickCommands.map((cmd) => (
            <Button
              key={cmd.command}
              variant="outline"
              size="sm"
              onClick={() => handleQuickCommand(cmd.command)}
              disabled={!isConnected}
              className="h-7 text-xs"
            >
              {cmd.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-3 bg-card border-t border-border">
        <div className="flex gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSendMessage();
              }
            }}
            placeholder={isConnected ? "Type command..." : "Connect to send messages"}
            disabled={!isConnected}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!isConnected || !inputMessage.trim()}
            size="sm"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MobileSerialMonitor;
