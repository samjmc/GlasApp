import { useQuery } from '@tanstack/react-query';

interface PerformanceScoreBreakdownProps {
  politicianName: string;
}

interface PerformanceScoreData {
  id: number;
  politicianName: string;
  overallScore: number;
  legislativeProductivity: number;
  parliamentaryEngagement: number;
  constituencyService: number;
  publicMediaImpact: number;
  billsSponsored: number;
  questionsAsked: number;
  voteAttendance: number;
  committeeContributions: string;
  debatesSpoken: number;
  clinicsHeld: number;
  caseworkResolutionRate: number;
  localProjectsSecured: number;
  pressMentions: number;
  socialMediaEngagement: number;
  notes: string;
}

export function PerformanceScoreBreakdown({ politicianName }: PerformanceScoreBreakdownProps) {
  const { data: performanceData, isLoading, error } = useQuery<{
    success: boolean;
    data: PerformanceScoreData;
  }>({
    queryKey: [`/api/performance-scores/politician/${encodeURIComponent(politicianName)}`],
    enabled: !!politicianName,
  });

  if (isLoading) {
    return (
      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="text-sm text-gray-500">Loading performance breakdown...</div>
      </div>
    );
  }

  if (error || !performanceData?.success) {
    return (
      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="text-sm text-gray-500">No detailed performance data available</div>
      </div>
    );
  }

  const performance = performanceData.data;

  return (
    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <h4 className="text-sm font-semibold mb-3 text-blue-800 dark:text-blue-200">Performance Score Breakdown</h4>
      
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{performance.legislativeProductivity}/100</div>
          <div className="text-xs text-blue-700 dark:text-blue-300">Legislative</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{performance.parliamentaryEngagement}/100</div>
          <div className="text-xs text-blue-700 dark:text-blue-300">Parliamentary</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{performance.constituencyService}/100</div>
          <div className="text-xs text-blue-700 dark:text-blue-300">Constituency</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{performance.publicMediaImpact}/100</div>
          <div className="text-xs text-blue-700 dark:text-blue-300">Public Impact</div>
        </div>
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">📊 Legislative Productivity ({performance.legislativeProductivity}/100)</div>
          <div className="text-gray-600 dark:text-gray-400">
            Bills/Motions: {performance.billsSponsored} | Questions: {performance.questionsAsked} | Attendance: {performance.voteAttendance}%
          </div>
        </div>
        
        <div>
          <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">🏛️ Parliamentary Engagement ({performance.parliamentaryEngagement}/100)</div>
          <div className="text-gray-600 dark:text-gray-400">
            {performance.committeeContributions} | Debates: {performance.debatesSpoken}
          </div>
        </div>
        
        <div>
          <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">🏠 Constituency Service ({performance.constituencyService}/100)</div>
          <div className="text-gray-600 dark:text-gray-400">
            Clinics: {performance.clinicsHeld}/6mths | Casework: {performance.caseworkResolutionRate}% | Projects: {performance.localProjectsSecured}
          </div>
        </div>
        
        <div>
          <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">📢 Public & Media Impact ({performance.publicMediaImpact}/100)</div>
          <div className="text-gray-600 dark:text-gray-400">
            Press: {performance.pressMentions} mentions | Social Media: {performance.socialMediaEngagement}/100
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{performance.overallScore}/100</div>
          <div className="text-xs text-blue-700 dark:text-blue-300">Overall Performance Score</div>
        </div>
        {performance.notes && (
          <div className="text-xs text-gray-500 mt-2 italic text-center">
            {performance.notes}
          </div>
        )}
      </div>
    </div>
  );
}