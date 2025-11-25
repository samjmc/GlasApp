import React, { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface AddEvolutionPointProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

// Helper function to determine ideology based on political compass coordinates
const determineIdeology = (economic: number, social: number): string => {
  // Economic: negative = left, positive = right
  // Social: negative = libertarian, positive = authoritarian
  
  if (economic <= -6 && social <= -6) return "Libertarian Socialist";
  if (economic <= -6 && social >= 6) return "Authoritarian Socialist";
  if (economic >= 6 && social <= -6) return "Libertarian Capitalist";
  if (economic >= 6 && social >= 6) return "Authoritarian Capitalist";
  
  if (economic <= -6 && social < 6 && social > -6) return "Left-Wing";
  if (economic >= 6 && social < 6 && social > -6) return "Right-Wing";
  if (social <= -6 && economic < 6 && economic > -6) return "Libertarian";
  if (social >= 6 && economic < 6 && economic > -6) return "Authoritarian";
  
  if (economic < -3 && social < -3) return "Left-Libertarian";
  if (economic < -3 && social > 3) return "Left-Authoritarian";
  if (economic > 3 && social < -3) return "Right-Libertarian";
  if (economic > 3 && social > 3) return "Right-Authoritarian";
  
  return "Centrist";
};

const AddEvolutionPoint: React.FC<AddEvolutionPointProps> = ({ onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    economicScore: 0,
    socialScore: 0,
    label: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'economicScore' || name === 'socialScore' 
        ? parseFloat(value) 
        : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate scores are within range
    if (formData.economicScore < -10 || formData.economicScore > 10 || 
        formData.socialScore < -10 || formData.socialScore > 10) {
      toast({
        title: "Invalid scores",
        description: "Economic and social scores must be between -10 and 10",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Determine ideology based on scores
      const ideology = determineIdeology(formData.economicScore, formData.socialScore);
      
      const response = await fetch('/api/political-evolution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          ideology
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Refresh political evolution data
        await queryClient.invalidateQueries({ queryKey: ['/api/political-evolution'] });
        
        toast({
          title: "Evolution point added",
          description: "Your political evolution point has been recorded",
        });
        
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast({
          title: "Failed to add point",
          description: data.message || "An error occurred",
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to save evolution point. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Evolution Point</CardTitle>
        <CardDescription>
          Record your current political position manually
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="label">Label (Optional)</Label>
            <Input
              id="label"
              name="label"
              placeholder="e.g., After 2024 Election"
              value={formData.label}
              onChange={handleChange}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              A short label to identify this point in your evolution
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="economicScore">Economic Score (-10 to 10)</Label>
            <div className="flex items-center space-x-2">
              <span className="text-sm">Left (-10)</span>
              <Input
                id="economicScore"
                name="economicScore"
                type="range"
                min="-10"
                max="10"
                step="0.5"
                value={formData.economicScore}
                onChange={handleChange}
                disabled={isSubmitting}
                className="flex-1"
              />
              <span className="text-sm">Right (10)</span>
            </div>
            <p className="text-center font-medium">{formData.economicScore}</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="socialScore">Social Score (-10 to 10)</Label>
            <div className="flex items-center space-x-2">
              <span className="text-sm">Libertarian (-10)</span>
              <Input
                id="socialScore"
                name="socialScore"
                type="range"
                min="-10"
                max="10"
                step="0.5"
                value={formData.socialScore}
                onChange={handleChange}
                disabled={isSubmitting}
                className="flex-1"
              />
              <span className="text-sm">Authoritarian (10)</span>
            </div>
            <p className="text-center font-medium">{formData.socialScore}</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <textarea
              id="notes"
              name="notes"
              placeholder="Why did your views change? What influenced you?"
              value={formData.notes}
              onChange={handleChange}
              disabled={isSubmitting}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          
          <div className="pt-2">
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm font-medium">
                Current Position:
                {formData.economicScore !== 0 && formData.socialScore !== 0 ? (
                  <span className="ml-2">{determineIdeology(formData.economicScore, formData.socialScore)}</span>
                ) : (
                  <span className="ml-2 text-muted-foreground">Adjust the sliders to see your ideology</span>
                )}
              </p>
            </div>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Save Evolution Point'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default AddEvolutionPoint;