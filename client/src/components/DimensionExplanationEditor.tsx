import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DimensionExplanation {
  economic?: string;
  social?: string;
  cultural?: string;
  globalism?: string;
  environmental?: string;
  authority?: string;
  welfare?: string;
  technocratic?: string;
}

interface DimensionExplanationEditorProps {
  partyId: string;
  partyName: string;
  explanations: DimensionExplanation;
  onSave: (partyId: string, explanations: DimensionExplanation) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DimensionExplanationEditor({
  partyId,
  partyName,
  explanations,
  onSave,
  open,
  onOpenChange
}: DimensionExplanationEditorProps) {
  const [editedExplanations, setEditedExplanations] = useState<DimensionExplanation>({...explanations});
  const [activeTab, setActiveTab] = useState("economic");

  const handleInputChange = (dimension: keyof DimensionExplanation, value: string) => {
    setEditedExplanations(prev => ({
      ...prev,
      [dimension]: value
    }));
  };

  const handleSave = () => {
    onSave(partyId, editedExplanations);
    onOpenChange(false);
  };

  const dimensionLabels: Record<keyof DimensionExplanation, string> = {
    economic: "Economic",
    social: "Social",
    cultural: "Cultural",
    globalism: "Globalism",
    environmental: "Environmental",
    authority: "Authority",
    welfare: "Welfare",
    technocratic: "Governance"
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Dimension Explanations for {partyName}</DialogTitle>
          <DialogDescription>
            Update the explanations for each political dimension. These will appear when users hover over dimension values.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 mb-4">
              {(Object.keys(dimensionLabels) as Array<keyof DimensionExplanation>).map(dimension => (
                <TabsTrigger key={dimension} value={dimension}>
                  {dimensionLabels[dimension]}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {(Object.keys(dimensionLabels) as Array<keyof DimensionExplanation>).map(dimension => (
              <TabsContent key={dimension} value={dimension}>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">{dimensionLabels[dimension]} Explanation</h3>
                  <Textarea
                    placeholder={`Explain ${partyName}'s position on ${dimensionLabels[dimension].toLowerCase()} issues...`}
                    value={editedExplanations[dimension] || ""}
                    onChange={(e) => handleInputChange(dimension, e.target.value)}
                    rows={5}
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Explanations</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}