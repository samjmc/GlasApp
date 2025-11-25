import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface ShareResultsProps {
  economic: number;
  social: number;
}

const ShareResults = ({ economic, social }: ShareResultsProps) => {
  const [shareCode] = useState<string>(() => {
    // Generate a random share code for this session
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  });
  
  const shareUrl = `${window.location.origin}/results/${shareCode}`;
  const shareInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const handleCopy = () => {
    if (shareInputRef.current) {
      shareInputRef.current.select();
      document.execCommand('copy');
      
      toast({
        title: "Link Copied",
        description: "Share link has been copied to clipboard!",
      });
    }
  };
  
  const handleTwitterShare = () => {
    const text = `Check out my Political Compass results: Economic: ${economic.toFixed(1)}, Social: ${social.toFixed(1)}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`);
  };
  
  const handleFacebookShare = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`);
  };
  
  const handleDownloadImage = () => {
    // In a real implementation, this would generate an image
    toast({
      title: "Feature Coming Soon",
      description: "Image download functionality will be available soon.",
    });
  };
  
  return (
    <Card className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <CardContent className="p-6">
        <h3 className="text-xl font-semibold mb-4">Share Your Results</h3>
        
        <div className="flex space-x-3 mb-4">
          <Button 
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4"
            onClick={handleTwitterShare}
          >
            <i className="fab fa-twitter mr-2"></i> Twitter
          </Button>
          <Button 
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4"
            onClick={handleFacebookShare}
          >
            <i className="fab fa-facebook-f mr-2"></i> Facebook
          </Button>
        </div>
        
        <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
          <div className="text-sm mb-2 font-medium">Compare with a friend:</div>
          <div className="flex">
            <Input
              ref={shareInputRef}
              value={shareUrl}
              className="flex-grow rounded-l-md border border-gray-300 dark:border-gray-600 dark:bg-gray-800 p-2 text-sm"
              readOnly
            />
            <Button 
              className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 px-3 rounded-r-md transition-colors"
              onClick={handleCopy}
            >
              <i className="far fa-copy"></i>
            </Button>
          </div>
        </div>
        
        <div>
          <Button 
            variant="outline"
            className="w-full border border-indigo-600 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 font-medium py-2 px-4"
            onClick={handleDownloadImage}
          >
            <i className="fas fa-download mr-2"></i> Download as Image
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ShareResults;
