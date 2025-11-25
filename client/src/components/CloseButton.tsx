import React from 'react';
import { Button } from '@/components/ui/button';

interface CloseButtonProps {
  onClose: () => void;
}

/**
 * A specialized close button component that prevents the default click
 * behavior to avoid closing parent containers like popups.
 */
const CloseButton: React.FC<CloseButtonProps> = ({ onClose }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      className="h-5 w-5 p-0 rounded-full" 
      onClick={handleClick}
    >
      ✕
    </Button>
  );
};

export default CloseButton;