import React from 'react';
import ElectionResults from '../components/ElectionResults';
import { Helmet } from 'react-helmet';

const ElectionResultsPage: React.FC = () => {
  return (
    <div className="container py-6 space-y-6">
      <Helmet>
        <title>2024 Irish Election Results | Glas Politics</title>
        <meta name="description" content="View comprehensive data visualization of the 2024 Irish election results. Explore constituency-level breakdowns, party performance, and projected seats." />
      </Helmet>
      
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">2024 Irish Election Results</h1>
        <p className="text-muted-foreground max-w-3xl">
          Explore real data from the 2024 Irish general election. View national summaries, party performance, and constituency-level breakdowns.
        </p>
      </div>
      
      <ElectionResults />
    </div>
  );
};

export default ElectionResultsPage;