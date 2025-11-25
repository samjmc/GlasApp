import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConstituencyDetail, TD } from '../assets/constituency-simplified';

interface ElectoralDistrictDetailViewProps {
  constituencyName: string;
  constituencyData: ConstituencyDetail;
}

export const ElectoralDistrictDetailView: React.FC<ElectoralDistrictDetailViewProps> = ({
  constituencyName,
  constituencyData
}) => {
  const { seats, population, urbanCenters, outgoingTDs } = constituencyData;
  
  // Function to get party color
  const getPartyColor = (party: string): string => {
    const partyColors: Record<string, string> = {
      'Fianna Fáil': 'bg-green-600',
      'Fine Gael': 'bg-blue-600',
      'Sinn Féin': 'bg-emerald-700',
      'Green Party': 'bg-green-400',
      'Labour Party': 'bg-red-600',
      'Social Democrats': 'bg-purple-600',
      'Solidarity–PBP': 'bg-red-700',
      'Independent': 'bg-gray-600',
      'Aontú': 'bg-orange-700',
    };
    
    return partyColors[party] || 'bg-gray-500';
  };
  
  return (
    <Card className="w-full shadow-md">
      <CardHeader className="bg-blue-800 text-white">
        <CardTitle className="text-2xl font-bold">{constituencyName}</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="my-2">
          <h3 className="text-lg font-semibold mb-1">Here's what you need to know about this constituency:</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col">
              <span className="text-gray-600 font-medium">Urban Centers:</span>
              <span className="font-semibold">{urbanCenters}</span>
            </div>
            
            <div className="flex flex-col">
              <span className="text-gray-600 font-medium">Population:</span>
              <span className="font-semibold">{population.toLocaleString()}</span>
            </div>
            
            <div className="flex flex-col">
              <span className="text-gray-600 font-medium">Seats:</span>
              <span className="font-semibold">{seats}</span>
            </div>
          </div>
          
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">Outgoing TDs:</h3>
            <div className="space-y-2">
              {outgoingTDs.map((td: TD, index: number) => (
                <div key={index} className="flex items-center gap-2">
                  <Badge className={`${getPartyColor(td.party)} text-white`}>
                    {td.party}
                  </Badge>
                  <span className="font-medium">{td.name}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-6 flex gap-2 justify-center">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              Candidates
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              Listen
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
              Read
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ElectoralDistrictDetailView;