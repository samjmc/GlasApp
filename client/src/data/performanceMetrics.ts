// Performance metrics for Irish political parties
// These metrics evaluate how well parties deliver on their promises

export interface PerformanceMetrics {
  pledgeFulfillment: number;  // Percentage of election promises fulfilled (0-1)
  consistency: number;        // How consistent party remains with its stated positions (0-1)
  activityScore: number;      // Parliamentary attendance and participation (0-1)
  integrity: number;          // Ethical conduct and transparency (0-1)
}

export interface TrustworthinessMetrics {
  transparencyScore: number;  // How open the party is about its operations and funding (0-1)
  factualAccuracy: number;    // Accuracy of claims and statements made by party (0-1)
  publicAccountability: number; // Willingness to admit mistakes and take responsibility (0-1)
  conflictOfInterest: number; // Absence of concerning conflicts of interest (0-1)
}

export interface PartyMetrics {
  performance: PerformanceMetrics;
  trustworthiness: TrustworthinessMetrics;
}

// Calculate overall performance score (weighted average)
export const calculatePerformanceScore = (metrics: PerformanceMetrics): number => {
  return (
    0.3 * metrics.pledgeFulfillment +
    0.25 * metrics.consistency +
    0.2 * metrics.activityScore +
    0.25 * metrics.integrity
  );
};

// Calculate overall trustworthiness score (weighted average)
export const calculateTrustworthinessScore = (metrics: TrustworthinessMetrics): number => {
  return (
    0.3 * metrics.transparencyScore +
    0.3 * metrics.factualAccuracy +
    0.25 * metrics.publicAccountability +
    0.15 * metrics.conflictOfInterest
  );
};

// Party metrics data
export const partyMetricsData: Record<string, PartyMetrics> = {
  "Fianna Fáil": {
    performance: {
      pledgeFulfillment: 0.42,
      consistency: 0.51,
      activityScore: 0.65,
      integrity: 0.38
    },
    trustworthiness: {
      transparencyScore: 0.45,
      factualAccuracy: 0.52,
      publicAccountability: 0.40,
      conflictOfInterest: 0.35
    }
  },
  "Fine Gael": {
    performance: {
      pledgeFulfillment: 0.48,
      consistency: 0.62,
      activityScore: 0.72,
      integrity: 0.55
    },
    trustworthiness: {
      transparencyScore: 0.58,
      factualAccuracy: 0.61,
      publicAccountability: 0.52,
      conflictOfInterest: 0.49
    }
  },
  "Sinn Féin": {
    performance: {
      pledgeFulfillment: 0.60,
      consistency: 0.81,
      activityScore: 0.75,
      integrity: 0.63
    },
    trustworthiness: {
      transparencyScore: 0.65,
      factualAccuracy: 0.59,
      publicAccountability: 0.62,
      conflictOfInterest: 0.57
    }
  },
  "Labour Party": {
    performance: {
      pledgeFulfillment: 0.39,
      consistency: 0.55,
      activityScore: 0.68,
      integrity: 0.61
    },
    trustworthiness: {
      transparencyScore: 0.64,
      factualAccuracy: 0.60,
      publicAccountability: 0.55,
      conflictOfInterest: 0.59
    }
  },
  "Green Party": {
    performance: {
      pledgeFulfillment: 0.56,
      consistency: 0.72,
      activityScore: 0.62,
      integrity: 0.78
    },
    trustworthiness: {
      transparencyScore: 0.76,
      factualAccuracy: 0.72,
      publicAccountability: 0.68,
      conflictOfInterest: 0.70
    }
  },
  "Social Democrats": {
    performance: {
      pledgeFulfillment: 0.64,
      consistency: 0.76,
      activityScore: 0.61,
      integrity: 0.82
    },
    trustworthiness: {
      transparencyScore: 0.79,
      factualAccuracy: 0.75,
      publicAccountability: 0.72,
      conflictOfInterest: 0.75
    }
  },
  "People Before Profit": {
    performance: {
      pledgeFulfillment: 0.72,
      consistency: 0.85,
      activityScore: 0.55,
      integrity: 0.79
    },
    trustworthiness: {
      transparencyScore: 0.75,
      factualAccuracy: 0.68,
      publicAccountability: 0.80,
      conflictOfInterest: 0.82
    }
  },
  "Aontú": {
    performance: {
      pledgeFulfillment: 0.58,
      consistency: 0.80,
      activityScore: 0.45,
      integrity: 0.62
    },
    trustworthiness: {
      transparencyScore: 0.62,
      factualAccuracy: 0.60,
      publicAccountability: 0.55,
      conflictOfInterest: 0.65
    }
  },
  "Independent Ireland": {
    performance: {
      pledgeFulfillment: 0.41,
      consistency: 0.65,
      activityScore: 0.48,
      integrity: 0.55
    },
    trustworthiness: {
      transparencyScore: 0.55,
      factualAccuracy: 0.50,
      publicAccountability: 0.45,
      conflictOfInterest: 0.52
    }
  }
};