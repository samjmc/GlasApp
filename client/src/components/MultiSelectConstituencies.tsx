import React, { useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

interface MultiSelectConstituenciesProps {
  constituencies: Array<{name: string}>;
  selectedConstituencies: string[];
  onChange: (selected: string[]) => void;
}

const MultiSelectConstituencies: React.FC<MultiSelectConstituenciesProps> = ({
  constituencies,
  selectedConstituencies,
  onChange
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleConstituency = (constituencyName: string) => {
    const newSelection = selectedConstituencies.includes(constituencyName)
      ? selectedConstituencies.filter(name => name !== constituencyName)
      : [...selectedConstituencies, constituencyName];
    
    onChange(newSelection);
  };

  const clearAll = () => {
    onChange([]);
  };

  const selectAll = () => {
    onChange(constituencies.map(c => c.name));
  };

  return (
    <div className="relative w-full">
      <Button 
        variant="outline"
        className="w-full justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">
          {selectedConstituencies.length === 0 
            ? 'Select constituencies' 
            : `${selectedConstituencies.length} selected`}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </Button>
      
      {selectedConstituencies.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {selectedConstituencies.map(name => (
            <div key={name} className="bg-secondary text-secondary-foreground rounded-sm px-2 py-1 text-xs flex items-center gap-1">
              {name}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => toggleConstituency(name)} 
              />
            </div>
          ))}
          {selectedConstituencies.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-xs"
              onClick={clearAll}
            >
              Clear all
            </Button>
          )}
        </div>
      )}
      
      {isOpen && (
        <Card className="absolute top-full z-[100] w-full mt-1 max-h-60 overflow-auto shadow-lg">
          <CardContent className="p-1">
            <div className="flex justify-between p-2 border-b">
              <Button variant="ghost" size="sm" onClick={selectAll}>Select all</Button>
              <Button variant="ghost" size="sm" onClick={clearAll}>Clear all</Button>
            </div>
            <div className="p-1">
              {constituencies.map(constituency => (
                <div 
                  key={constituency.name}
                  className="flex items-center space-x-2 p-2 hover:bg-secondary/50 rounded-md cursor-pointer"
                  onClick={() => toggleConstituency(constituency.name)}
                >
                  <Checkbox 
                    checked={selectedConstituencies.includes(constituency.name)}
                    onCheckedChange={() => {}}
                    id={`checkbox-${constituency.name}`}
                  />
                  <label 
                    htmlFor={`checkbox-${constituency.name}`}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {constituency.name}
                  </label>
                  {selectedConstituencies.includes(constituency.name) && (
                    <Check className="h-4 w-4" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MultiSelectConstituencies;