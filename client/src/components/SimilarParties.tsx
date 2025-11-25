import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { politicalParties } from "@shared/data";

interface SimilarPartiesProps {
  economic: number;
  social: number;
}

const SimilarParties = ({ economic, social }: SimilarPartiesProps) => {
  const [selectedCountry, setSelectedCountry] = useState<string>("ireland");
  const [closestParties, setClosestParties] = useState<typeof politicalParties>([]);
  
  useEffect(() => {
    // Filter parties by country
    const countryParties = politicalParties.filter(party => party.country === selectedCountry);
    
    // Calculate distances and sort
    const partiesWithDistances = countryParties.map(party => {
      const distance = Math.sqrt(
        Math.pow(party.economic - economic, 2) + 
        Math.pow(party.social - social, 2)
      );
      return { ...party, distance };
    });
    
    // Sort by closest
    const sorted = partiesWithDistances.sort((a, b) => a.distance - b.distance);
    
    // Take top 3
    setClosestParties(sorted.slice(0, 3));
  }, [selectedCountry, economic, social]);
  
  const handleCountryChange = (value: string) => {
    setSelectedCountry(value);
  };
  
  return (
    <Card className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <CardContent className="p-6">
        <h3 className="text-xl font-semibold mb-4">Closest Political Parties</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2" htmlFor="country-select">
            Select Country:
          </label>
          <Select value={selectedCountry} onValueChange={handleCountryChange}>
            <SelectTrigger className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700">
              <SelectValue placeholder="Select a country" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="ireland">Ireland</SelectItem>
                <SelectItem value="uk">United Kingdom</SelectItem>
                <SelectItem value="us">United States</SelectItem>
                <SelectItem value="france">France</SelectItem>
                <SelectItem value="germany">Germany</SelectItem>
                <SelectItem value="canada">Canada</SelectItem>
                <SelectItem value="australia">Australia</SelectItem>
                <SelectItem value="spain">Spain</SelectItem>
                <SelectItem value="italy">Italy</SelectItem>
                <SelectItem value="japan">Japan</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-4 mt-6">
          {closestParties.map(party => (
            <div key={party.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
              <div className="flex items-center mb-2">
                <span 
                  className="w-3 h-3 rounded-full mr-2" 
                  style={{ backgroundColor: party.color }}
                ></span>
                <h4 className="font-medium">{party.name}</h4>
              </div>
              <div className="flex text-sm text-gray-500 dark:text-gray-400 mb-2">
                <span className="mr-3">Economic: {party.economic.toFixed(1)}</span>
                <span>Social: {party.social.toFixed(1)}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {party.description}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default SimilarParties;
