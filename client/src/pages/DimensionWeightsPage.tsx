import React, { useEffect } from 'react';
import { useLocation } from 'wouter';

/**
 * DimensionWeightsPage - DEPRECATED
 * 
 * This page is no longer used in the quiz flow.
 * Quiz now goes directly to results page.
 * Weights can be adjusted on the results page itself.
 * 
 * Redirects to results page for backwards compatibility.
 */
const DimensionWeightsPage: React.FC = () => {
  const [, navigate] = useLocation();
  
  useEffect(() => {
    // Redirect to results page
    navigate('/enhanced-results');
  }, [navigate]);
  
  return null;
};

export default DimensionWeightsPage;
