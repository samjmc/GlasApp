/**
 * Personalized Score Display Component
 * Shows objective process scores vs user's personalized score
 */

import { Info, TrendingUp, TrendingDown } from 'lucide-react';

interface PersonalizedScoreProps {
  politicianName: string;
  
  // Objective process scores (same for all users)
  objectiveScores: {
    transparency: number;
    effectiveness: number;
    integrity: number;
    consistency: number;
  };
  
  // User's personalized score (based on their votes)
  personalizedScore?: number;
  policyAlignment?: number; // -10 to +10
  policiesVotedOn?: number;
  
  // Platform aggregate
  platformAverage?: number;
  
  userId?: string;
}

export function PersonalizedScoreDisplay({
  politicianName,
  objectiveScores,
  personalizedScore,
  policyAlignment,
  policiesVotedOn = 0,
  platformAverage,
  userId
}: PersonalizedScoreProps) {
  
  const hasVoted = policiesVotedOn > 0;
  
  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Average';
    return 'Below Average';
  };

  const objectiveAverage = Math.round(
    (objectiveScores.transparency +
     objectiveScores.effectiveness +
     objectiveScores.integrity +
     objectiveScores.consistency) / 4
  );

  return (
    <div className="space-y-4">
      {/* Main Score Card */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 shadow-sm">
        <div className="text-center mb-4">
          {hasVoted && personalizedScore !== undefined ? (
            <>
              <div className="text-xs text-gray-600 uppercase tracking-wide mb-1">
                Your Personalized Score
              </div>
              <div className={`text-5xl font-bold ${getScoreColor(personalizedScore)}`}>
                {personalizedScore}
                <span className="text-2xl text-gray-500">/100</span>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {getScoreLabel(personalizedScore)} • Based on your values
              </div>
            </>
          ) : (
            <>
              <div className="text-xs text-gray-600 uppercase tracking-wide mb-1">
                Objective Process Score
              </div>
              <div className={`text-5xl font-bold ${getScoreColor(objectiveAverage)}`}>
                {objectiveAverage}
                <span className="text-2xl text-gray-500">/100</span>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {getScoreLabel(objectiveAverage)}
              </div>
            </>
          )}
        </div>

        {/* Score Breakdown */}
        {hasVoted && personalizedScore !== undefined && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Objective Process</div>
              <div className="text-2xl font-bold text-gray-900">{objectiveAverage}</div>
              <div className="text-xs text-gray-500">Same for all users</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Policy Alignment</div>
              <div className={`text-2xl font-bold flex items-center gap-1 ${
                policyAlignment && policyAlignment > 0 ? 'text-green-600' :
                policyAlignment && policyAlignment < 0 ? 'text-red-600' :
                'text-gray-600'
              }`}>
                {policyAlignment && policyAlignment > 0 && '+'}
                {policyAlignment || 0}
                {policyAlignment && policyAlignment > 0 ? (
                  <TrendingUp size={16} />
                ) : policyAlignment && policyAlignment < 0 ? (
                  <TrendingDown size={16} />
                ) : null}
              </div>
              <div className="text-xs text-gray-500">Based on your votes</div>
            </div>
          </div>
        )}

        {/* Voting Prompt */}
        {!hasVoted && userId && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-3">
            <div className="flex items-start gap-2 text-sm text-yellow-800">
              <Info size={16} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">Get Your Personalized Score!</p>
                <p className="text-xs text-yellow-700">
                  Vote on policies mentioned in news articles to see how {politicianName} 
                  aligns with YOUR values.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Objective Process Scores Detail */}
      <div>
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          📊 Objective Process Scores
          <span className="text-xs text-gray-500 font-normal">(Same for all users)</span>
        </h4>
        
        <div className="space-y-2">
          {[
            { label: 'Transparency', score: objectiveScores.transparency, desc: 'How open and honest' },
            { label: 'Effectiveness', score: objectiveScores.effectiveness, desc: 'Delivers on promises' },
            { label: 'Integrity', score: objectiveScores.integrity, desc: 'Ethical behavior' },
            { label: 'Consistency', score: objectiveScores.consistency, desc: 'Keeps their word' }
          ].map(({ label, score, desc }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-32 text-sm font-medium text-gray-700">{label}</div>
              <div className="flex-1">
                <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full ${
                      score >= 80 ? 'bg-green-500' :
                      score >= 60 ? 'bg-blue-500' :
                      score >= 40 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
              <div className={`w-12 text-right font-bold ${getScoreColor(score)}`}>
                {score}
              </div>
              <div className="w-32 text-xs text-gray-500 hidden md:block">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison View */}
      {platformAverage && hasVoted && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h5 className="text-sm font-semibold mb-3">Score Comparison</h5>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <div className="text-xs text-gray-600 mb-1">Your Score</div>
              <div className={`text-2xl font-bold ${getScoreColor(personalizedScore || 0)}`}>
                {personalizedScore}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">All Users</div>
              <div className="text-2xl font-bold text-gray-700">
                {platformAverage}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Difference</div>
              <div className={`text-2xl font-bold ${
                (personalizedScore || 0) > platformAverage ? 'text-green-600' : 'text-red-600'
              }`}>
                {(personalizedScore || 0) > platformAverage ? '+' : ''}
                {(personalizedScore || 0) - platformAverage}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Footer */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
        <div className="flex items-start gap-2">
          <Info size={14} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium mb-1">How Scoring Works:</p>
            <ul className="space-y-1 text-blue-700">
              <li>• <strong>Process scores</strong> measure HOW they do their job (same for all)</li>
              <li>• <strong>Policy votes</strong> reflect whether YOU support their policies</li>
              <li>• <strong>Your score</strong> = 60% objective process + 40% your policy votes</li>
              <li>• Different values = different scores (that's democracy!)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PersonalizedScoreDisplay;























