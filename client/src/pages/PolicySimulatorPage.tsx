import React from 'react';
import PolicyImpactSimulator from '@/components/PolicyImpactSimulator';

const PolicySimulatorPage: React.FC = () => {
  return (
    <div className="container mx-auto py-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Interactive Policy Impact Simulator</h1>
          <p className="text-lg text-muted-foreground">
            Explore how different policy approaches might affect various aspects of Irish society. 
            Adjust the sliders to see how changes in government policy could impact different social, 
            economic, and environmental outcomes.
          </p>
        </div>
        
        <PolicyImpactSimulator />
        
        <div className="mt-12 bg-muted rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">About This Simulator</h2>
          <p className="mb-4">
            This interactive tool allows you to experiment with different policy approaches and see their 
            potential impacts across various aspects of society. The model is based on simplified assumptions 
            about policy interactions and is intended for educational purposes.
          </p>
          <p className="mb-4">
            Real-world policy outcomes are influenced by countless factors including global economic conditions, 
            historical context, geographic factors, and complex societal dynamics that cannot be fully captured 
            in a simulation.
          </p>
          <h3 className="text-lg font-semibold mb-2">How It Works</h3>
          <p>
            Each policy slider represents a spectrum from market-driven approaches (left) to state-managed approaches (right). 
            As you adjust these sliders, the simulator calculates potential impacts based on weighted relationships between 
            policies and outcomes. These relationships are derived from general political science concepts and are not 
            meant to represent a specific political ideology or definitive prediction.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PolicySimulatorPage;