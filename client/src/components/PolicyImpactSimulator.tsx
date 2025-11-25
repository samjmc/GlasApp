import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, RefreshCw, HelpCircle } from 'lucide-react';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface PolicyImpactSimulatorProps {
  partyId?: string;
  onCompletion?: () => void;
}

const PolicyImpactSimulator: React.FC<PolicyImpactSimulatorProps> = ({ partyId, onCompletion }) => {
  const [activeTab, setActiveTab] = useState<string>('policies');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  
  // Policy settings (simplified for this implementation)
  const [taxationValue, setTaxationValue] = useState(50);
  const [healthcareValue, setHealthcareValue] = useState(50);
  const [educationValue, setEducationValue] = useState(50);
  const [environmentValue, setEnvironmentValue] = useState(50);
  const [housingValue, setHousingValue] = useState(50);
  
  // Impact values
  const [economyImpact, setEconomyImpact] = useState(50);
  const [inequalityImpact, setInequalityImpact] = useState(50);
  const [publicServicesImpact, setPublicServicesImpact] = useState(50);
  const [sustainabilityImpact, setSustainabilityImpact] = useState(50);
  
  // Set initial policy values based on party
  useEffect(() => {
    if (partyId) {
      switch (partyId) {
        case 'ie-fg': // Fine Gael (center-right)
          setTaxationValue(35);
          setHealthcareValue(40);
          setEducationValue(45);
          setEnvironmentValue(60);
          setHousingValue(40);
          break;
        case 'ie-ff': // Fianna Fail (centrist)
          setTaxationValue(45);
          setHealthcareValue(55);
          setEducationValue(55);
          setEnvironmentValue(55);
          setHousingValue(50);
          break;
        case 'ie-sf': // Sinn Féin (left)
          setTaxationValue(70);
          setHealthcareValue(80);
          setEducationValue(75);
          setEnvironmentValue(65);
          setHousingValue(80);
          break;
        case 'ie-green': // Green Party
          setTaxationValue(60);
          setHealthcareValue(65);
          setEducationValue(60);
          setEnvironmentValue(90);
          setHousingValue(65);
          break;
        case 'ie-sd': // Social Democrats (center-left)
          setTaxationValue(65);
          setHealthcareValue(75);
          setEducationValue(70);
          setEnvironmentValue(70);
          setHousingValue(70);
          break;
        default:
          // Use default values for other parties
          break;
      }
    }
  }, [partyId]);
  
  // Calculate impacts when policy values change
  const calculateImpacts = () => {
    setIsSimulating(true);
    
    // Simulate calculation delay
    setTimeout(() => {
      // Calculate economy impact (weighted average of policies)
      const economy = (
        (taxationValue - 50) * -0.6 + // Lower taxes boost economy
        (healthcareValue - 50) * -0.3 + // Public healthcare may burden economy
        (educationValue - 50) * 0.5 + // Education boosts economy long-term
        (environmentValue - 50) * -0.4 + // Regulations may slow growth
        (housingValue - 50) * 0.4 // Housing construction stimulates economy
      ) * 0.2 + 50; // Scale and normalize
      
      // Calculate inequality impact
      const inequality = (
        (taxationValue - 50) * 0.8 + // Higher taxes reduce inequality
        (healthcareValue - 50) * 0.7 + // Public healthcare reduces inequality
        (educationValue - 50) * 0.6 + // Public education reduces inequality
        (environmentValue - 50) * 0.1 + // Environmental policy has minimal effect
        (housingValue - 50) * 0.6 // Public housing reduces inequality
      ) * 0.2 + 50; // Scale and normalize
      
      // Calculate public services impact
      const publicServices = (
        (taxationValue - 50) * 0.7 + // Higher taxes fund services
        (healthcareValue - 50) * 0.9 + // Public healthcare is a major service
        (educationValue - 50) * 0.8 + // Education is a major service
        (environmentValue - 50) * 0.2 + // Environmental policy affects some services
        (housingValue - 50) * 0.4 // Public housing is a service
      ) * 0.2 + 50; // Scale and normalize
      
      // Calculate sustainability impact
      const sustainability = (
        (taxationValue - 50) * 0.1 + // Taxation has minor effect
        (healthcareValue - 50) * 0.1 + // Healthcare has minor effect
        (educationValue - 50) * 0.3 + // Education affects sustainability awareness
        (environmentValue - 50) * 0.9 + // Environmental policy is primary driver
        (housingValue - 50) * 0.4 // Housing policy affects urban sustainability
      ) * 0.2 + 50; // Scale and normalize
      
      // Set the impacts (clamped to 0-100 range)
      setEconomyImpact(Math.min(100, Math.max(0, economy)));
      setInequalityImpact(Math.min(100, Math.max(0, inequality)));
      setPublicServicesImpact(Math.min(100, Math.max(0, publicServices)));
      setSustainabilityImpact(Math.min(100, Math.max(0, sustainability)));
      
      setIsSimulating(false);
      setActiveTab('impacts');
      
      // Call the completion callback
      if (onCompletion) {
        onCompletion();
      }
    }, 1500);
  };
  
  // Reset all policies to default values
  const resetPolicies = () => {
    setTaxationValue(50);
    setHealthcareValue(50);
    setEducationValue(50);
    setEnvironmentValue(50);
    setHousingValue(50);
    
    setEconomyImpact(50);
    setInequalityImpact(50);
    setPublicServicesImpact(50);
    setSustainabilityImpact(50);
  };
  
  // Helper function to get policy description
  const getPolicyDescription = (value: number) => {
    if (value < 30) return "Strongly market-oriented";
    if (value < 45) return "Market-oriented";
    if (value < 55) return "Balanced approach";
    if (value < 75) return "State-guided";
    return "Heavily state-managed";
  };
  
  // Helper function to get impact level description
  const getImpactLevel = (value: number) => {
    if (value < 20) return "Very Low";
    if (value < 40) return "Low";
    if (value < 60) return "Moderate";
    if (value < 80) return "High";
    return "Very High";
  };

  return (
    <div className="w-full">
      <div className="flex flex-row justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold">Policy Impact Simulator</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Adjust policies and see their potential impact on society
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={resetPolicies}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 mb-6">
          <TabsTrigger value="policies">Policy Settings</TabsTrigger>
          <TabsTrigger value="impacts">Impact Analysis</TabsTrigger>
        </TabsList>
        
        <TabsContent value="policies" className="space-y-6">
          {/* Taxation Policy */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div>
                <Label htmlFor="taxation" className="text-lg font-medium">Taxation</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">Adjust taxation levels from progressive to flat</p>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Taxation Impact Details</DialogTitle>
                    <DialogDescription>
                      How taxation policy affects different areas
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="font-medium">Economy</span>
                        <span className="text-red-600">-60%</span>
                      </div>
                      <p className="text-sm text-gray-500">Higher taxes may slow economic growth but fund public services</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="font-medium">Inequality</span>
                        <span className="text-green-600">+80%</span>
                      </div>
                      <p className="text-sm text-gray-500">Progressive taxation tends to reduce inequality</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm min-w-[80px]">Market-driven</span>
              <Slider
                id="taxation"
                min={0}
                max={100}
                step={1}
                value={[taxationValue]}
                onValueChange={(values) => setTaxationValue(values[0])}
                className="flex-1"
              />
              <span className="text-sm min-w-[80px] text-right">State-managed</span>
            </div>

            <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-1">
              Current setting: {getPolicyDescription(taxationValue)}
            </div>

            <Separator className="my-4" />
          </div>
          
          {/* Healthcare Policy */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div>
                <Label htmlFor="healthcare" className="text-lg font-medium">Healthcare</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">Adjust healthcare from private to public</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm min-w-[80px]">Market-driven</span>
              <Slider
                id="healthcare"
                min={0}
                max={100}
                step={1}
                value={[healthcareValue]}
                onValueChange={(values) => setHealthcareValue(values[0])}
                className="flex-1"
              />
              <span className="text-sm min-w-[80px] text-right">State-managed</span>
            </div>

            <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-1">
              Current setting: {getPolicyDescription(healthcareValue)}
            </div>

            <Separator className="my-4" />
          </div>
          
          {/* Education Policy */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div>
                <Label htmlFor="education" className="text-lg font-medium">Education</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">Adjust education funding and approach</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm min-w-[80px]">Market-driven</span>
              <Slider
                id="education"
                min={0}
                max={100}
                step={1}
                value={[educationValue]}
                onValueChange={(values) => setEducationValue(values[0])}
                className="flex-1"
              />
              <span className="text-sm min-w-[80px] text-right">State-managed</span>
            </div>

            <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-1">
              Current setting: {getPolicyDescription(educationValue)}
            </div>

            <Separator className="my-4" />
          </div>
          
          {/* Environmental Policy */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div>
                <Label htmlFor="environment" className="text-lg font-medium">Environmental Policy</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">Adjust from minimal regulation to strict protection</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm min-w-[80px]">Market-driven</span>
              <Slider
                id="environment"
                min={0}
                max={100}
                step={1}
                value={[environmentValue]}
                onValueChange={(values) => setEnvironmentValue(values[0])}
                className="flex-1"
              />
              <span className="text-sm min-w-[80px] text-right">State-managed</span>
            </div>

            <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-1">
              Current setting: {getPolicyDescription(environmentValue)}
            </div>

            <Separator className="my-4" />
          </div>
          
          {/* Housing Policy */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div>
                <Label htmlFor="housing" className="text-lg font-medium">Housing Policy</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">Adjust from market-driven to public housing emphasis</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm min-w-[80px]">Market-driven</span>
              <Slider
                id="housing"
                min={0}
                max={100}
                step={1}
                value={[housingValue]}
                onValueChange={(values) => setHousingValue(values[0])}
                className="flex-1"
              />
              <span className="text-sm min-w-[80px] text-right">State-managed</span>
            </div>

            <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-1">
              Current setting: {getPolicyDescription(housingValue)}
            </div>

            <Separator className="my-4" />
          </div>
          
          <div className="flex justify-center mt-6">
            <Button 
              onClick={calculateImpacts} 
              className="px-8"
              disabled={isSimulating}
            >
              {isSimulating ? (
                <>Simulating Impact</>
              ) : (
                <>
                  Calculate Impact
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
          
          {isSimulating && (
            <div className="mt-4">
              <Progress value={65} className="h-2" />
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                Analyzing policy interactions and calculating societal impacts...
              </p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="impacts" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Economy Impact */}
            <div className="border rounded-lg p-4 overflow-hidden">
              <div className="pb-2">
                <h4 className="text-lg font-medium">Economic Growth</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Impact on GDP growth and economic productivity</p>
              </div>
              <div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Low Impact</span>
                    <span>High Impact</span>
                  </div>
                  <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-in-out"
                      style={{ width: `${economyImpact}%` }}
                    ></div>
                  </div>
                  <div className="text-center font-medium">
                    {getImpactLevel(economyImpact)}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Inequality Impact */}
            <div className="border rounded-lg p-4 overflow-hidden">
              <div className="pb-2">
                <h4 className="text-lg font-medium">Social Inequality</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Impact on income and wealth distribution</p>
              </div>
              <div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Low Impact</span>
                    <span>High Impact</span>
                  </div>
                  <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-in-out"
                      style={{ width: `${inequalityImpact}%` }}
                    ></div>
                  </div>
                  <div className="text-center font-medium">
                    {getImpactLevel(inequalityImpact)}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Public Services Impact */}
            <div className="border rounded-lg p-4 overflow-hidden">
              <div className="pb-2">
                <h4 className="text-lg font-medium">Public Services</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Quality and accessibility of public services</p>
              </div>
              <div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Low Impact</span>
                    <span>High Impact</span>
                  </div>
                  <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500 rounded-full transition-all duration-500 ease-in-out"
                      style={{ width: `${publicServicesImpact}%` }}
                    ></div>
                  </div>
                  <div className="text-center font-medium">
                    {getImpactLevel(publicServicesImpact)}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Sustainability Impact */}
            <div className="border rounded-lg p-4 overflow-hidden">
              <div className="pb-2">
                <h4 className="text-lg font-medium">Environmental Sustainability</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Long-term environmental health and conservation</p>
              </div>
              <div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Low Impact</span>
                    <span>High Impact</span>
                  </div>
                  <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 rounded-full transition-all duration-500 ease-in-out"
                      style={{ width: `${sustainabilityImpact}%` }}
                    ></div>
                  </div>
                  <div className="text-center font-medium">
                    {getImpactLevel(sustainabilityImpact)}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center mt-6">
            <Button 
              onClick={() => setActiveTab('policies')}
              variant="outline"
              className="px-8"
            >
              Adjust Policies
            </Button>
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="flex justify-between mt-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Note: This simulator is for educational purposes only and uses simplified models.
        </p>
      </div>
    </div>
  );
};

export default PolicyImpactSimulator;