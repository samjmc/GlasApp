/**
 * Latest Polls Widget
 * 
 * Compact widget showing most recent polling data
 * Perfect for homepage sidebar or featured section
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

interface LatestPoll {
  party_name: string;
  party_logo?: string;
  party_color?: string;
  first_preference: number;
  poll_date: string;
  source_name: string;
  change_from_previous: number;
}

export function LatestPollsWidget() {
  const [polls, setPolls] = useState<LatestPoll[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLatestPolls();
  }, []);

  async function loadLatestPolls() {
    try {
      // Get latest polls with party logos
      const { data: pollData } = await supabase
        .from('latest_party_polls')
        .select('*')
        .eq('recency_rank', 1)
        .order('first_preference', { ascending: false })
        .limit(6);

      if (pollData) {
        // Fetch party logos
        const { data: parties } = await supabase
          .from('parties')
          .select('name, logo, color');
        
        const partyMap = new Map(
          (parties || []).map(p => [p.name, { logo: p.logo, color: p.color }])
        );
        
        // Merge poll data with party logos
        const enrichedPolls = pollData.map(poll => ({
          ...poll,
          party_logo: partyMap.get(poll.party_name)?.logo,
          party_color: partyMap.get(poll.party_name)?.color
        }));
        
        setPolls(enrichedPolls);
      }
    } catch (error) {
      console.error('Error loading polls:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-2/3 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-8 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (polls.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          📊 Latest Polls
        </h3>
        <p className="text-sm text-gray-500">No polling data available yet.</p>
        <a 
          href="/admin/polling/entry"
          className="text-xs text-blue-600 hover:underline mt-2 inline-block"
        >
          Add poll data →
        </a>
      </div>
    );
  }

  const latestPollDate = polls[0]?.poll_date;
  const latestSource = polls[0]?.source_name;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          📊 Latest Polls
        </h3>
        <a 
          href="/?tab=tds"
          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          View all <ArrowRight className="w-3 h-3" />
        </a>
      </div>

      {latestPollDate && (
        <div className="text-xs text-gray-500 mb-4 pb-3 border-b">
          {latestSource} • {new Date(latestPollDate).toLocaleDateString('en-IE', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          })}
        </div>
      )}

      <div className="space-y-3">
        {polls.map((poll, index) => (
          <div 
            key={index}
            className="flex items-center justify-between py-2 hover:bg-gray-50 rounded px-2 -mx-2 transition-colors"
          >
            <div className="flex items-center gap-2 flex-1">
              {poll.party_logo ? (
                <div className="w-8 h-8 rounded bg-white p-1 flex items-center justify-center flex-shrink-0 border border-gray-200">
                  <img 
                    src={poll.party_logo} 
                    alt={`${poll.party_name} logo`}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <span className="text-2xl flex-shrink-0">
                  {getPartyEmoji(poll.party_name)}
                </span>
              )}
              <span className="text-sm font-medium text-gray-700 truncate">
                {poll.party_name}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {poll.change_from_previous !== null && poll.change_from_previous !== undefined && (
                <div className="flex items-center gap-1">
                  {poll.change_from_previous > 0 ? (
                    <TrendingUp className="w-3 h-3 text-green-600" />
                  ) : poll.change_from_previous < 0 ? (
                    <TrendingDown className="w-3 h-3 text-red-600" />
                  ) : null}
                  <span 
                    className={`text-xs ${
                      poll.change_from_previous > 0 ? 'text-green-600' : 
                      poll.change_from_previous < 0 ? 'text-red-600' : 
                      'text-gray-500'
                    }`}
                  >
                    {poll.change_from_previous > 0 ? '+' : ''}
                    {poll.change_from_previous?.toFixed(1)}
                  </span>
                </div>
              )}

              <span className="text-lg font-bold text-blue-600 min-w-[3.5rem] text-right">
                {poll.first_preference?.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t text-center">
        <a 
          href="/?tab=tds"
          className="text-sm text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
        >
          View Full Rankings <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}

// Helper function to get party emoji
function getPartyEmoji(partyName: string): string {
  const emojiMap: { [key: string]: string } = {
    'Fianna Fáil': '🟢',
    'Fine Gael': '🔵',
    'Sinn Féin': '🟢',
    'Labour Party': '🔴',
    'Social Democrats': '🟣',
    'Green Party': '🌿',
    'People Before Profit': '🔴',
    'Solidarity': '🔴',
    'Aontú': '🟡',
    'Independents': '⚪',
  };

  // Try exact match first
  if (emojiMap[partyName]) return emojiMap[partyName];

  // Try partial match
  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (partyName.includes(key) || key.includes(partyName)) {
      return emoji;
    }
  }

  return '📊'; // Default emoji
}

export default LatestPollsWidget;

