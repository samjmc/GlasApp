import React, { useState, useEffect } from 'react';
import { getConstituencyStory, ConstituencyStory } from '../services/storyGenerator';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import CloseButton from './CloseButton';

interface ConstituencyStoryProps {
  constituencyName: string;
  partyData: {
    name: string;
    percent: number;
    color: string;
    seats?: number;
  }[];
  onClose: () => void;
  showStoryByDefault?: boolean;
}

const ConstituencyStoryPopup: React.FC<ConstituencyStoryProps> = ({
  constituencyName,
  partyData,
  onClose,
  showStoryByDefault = false
}) => {
  const [story, setStory] = useState<ConstituencyStory | null>(null);
  const [loading, setLoading] = useState(false);
  const [generateStory, setGenerateStory] = useState(showStoryByDefault);

  // Get top 2 parties
  const topParties = [...partyData]
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 2);
  
  // Fetch story data when requested
  useEffect(() => {
    if (generateStory && !story && !loading) {
      setLoading(true);
      
      // Format party data for the API
      const partiesForAPI = partyData.map(party => ({
        name: party.name,
        percent: party.percent,
        seats: party.seats || 0
      }));
      
      getConstituencyStory(constituencyName, partiesForAPI)
        .then(storyData => {
          setStory(storyData);
          setLoading(false);
        })
        .catch(error => {
          console.error('Error fetching story:', error);
          setLoading(false);
        });
    }
  }, [constituencyName, partyData, generateStory, story, loading]);

  return (
    <div className="p-1 max-w-[200px]">
      <div className="flex justify-between items-center mb-0.5">
        <h3 className="font-bold text-xs text-primary">{constituencyName}</h3>
        <CloseButton onClose={onClose} />
      </div>
      
      {topParties.length > 0 && (
        <div className="mt-1">
          <div className="font-medium text-xs">Top parties:</div>
          <div className="flex flex-col space-y-1 mt-1">
            {topParties.map(party => (
              <div key={party.name} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div 
                    className="w-2 h-2 rounded-full mr-1" 
                    style={{ backgroundColor: party.color }}
                  />
                  <span className="text-xs">{party.name}</span>
                </div>
                <span className="text-xs font-bold">{party.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {!generateStory && (
        <div className="mt-3">
          <Button 
            variant="outline" 
            size="sm"
            className="w-full"
            onClick={() => setGenerateStory(true)}
          >
            Show Constituency Story
          </Button>
        </div>
      )}
      
      {generateStory && (
        <div className="mt-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              <p className="text-sm text-muted-foreground">Generating story...</p>
            </div>
          ) : story ? (
            <div className="space-y-3">
              {story.historicalFact && (
                <div>
                  <p className="text-sm italic text-gray-700 dark:text-gray-300">{story.historicalFact}</p>
                </div>
              )}
              
              {story.keyIssues && story.keyIssues.length > 0 && (
                <div>
                  <div className="font-medium text-sm">Key issues:</div>
                  <ul className="list-disc list-inside text-xs mt-1">
                    {story.keyIssues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {story.politicalTrend && (
                <div>
                  <div className="font-medium text-sm">Political trend:</div>
                  <p className="text-xs">{story.politicalTrend}</p>
                </div>
              )}
              
              {story.notablePoliticians && story.notablePoliticians.length > 0 && (
                <div>
                  <div className="font-medium text-sm">Notable politicians:</div>
                  <ul className="list-disc list-inside text-xs mt-1">
                    {story.notablePoliticians.map((politician, i) => (
                      <li key={i}>{politician}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {story.economicFocus && (
                <div>
                  <div className="font-medium text-sm">Economic focus:</div>
                  <p className="text-xs">{story.economicFocus}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default ConstituencyStoryPopup;