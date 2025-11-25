/**
 * Scoring Methodology - Explanation of how rankings work
 */

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, Users, Building2 } from 'lucide-react';
import { Link } from 'wouter';

export function ScoringMethodology() {
  return (
    <Card className="p-6 md:p-8 bg-gradient-to-r from-purple-50 via-pink-50 to-blue-50 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-blue-900/20 border-2 border-purple-200">
      <div className="flex items-start gap-4">
        <Sparkles className="w-8 h-8 text-purple-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="text-2xl font-bold text-purple-900 dark:text-purple-100 mb-4">
            How Rankings Work
          </h4>
          
          <div className="space-y-4">
            {/* TD Scoring */}
            <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border border-purple-200/50">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <h5 className="font-semibold text-gray-900 dark:text-white">TD Performance Scores</h5>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                TDs are scored using ELO ratings based on AI analysis of Irish news from 11 sources. Scores combine 
                news sentiment, parliamentary activity, constituency work, and public ratings. Bias protection 
                (75-85% reduction) and promise tracking ensure fairness. Updated daily at 6 AM.
              </p>
            </div>

            {/* Party Scoring */}
            <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border border-purple-200/50">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h5 className="font-semibold text-gray-900 dark:text-white">Party Performance Scores</h5>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                Parties are ranked based on parliamentary activity: <strong>60% average attendance</strong> and{' '}
                <strong>40% questions asked per TD</strong>. This rewards active engagement while accounting for 
                party size, ensuring fair comparison across all parties.
              </p>
            </div>

            {/* Data Sources */}
            <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border border-purple-200/50">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-orange-600" />
                <h5 className="font-semibold text-gray-900 dark:text-white">Data Sources</h5>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                Rankings combine data from: <strong>11 Irish news sources</strong> (including mainstream and alternative 
                media), <strong>Oireachtas parliamentary records</strong>, <strong>public trust ratings</strong>, and{' '}
                <strong>AI-powered bias protection</strong> to ensure balanced, fair assessments.
              </p>
            </div>
          </div>

          <Link href="/about-scoring">
            <Button variant="link" className="text-purple-700 dark:text-purple-300 p-0 h-auto mt-4 font-semibold">
              Learn more about our methodology →
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}



