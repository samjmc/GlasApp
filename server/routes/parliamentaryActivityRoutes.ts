import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// Load parliamentary activity data
let parliamentaryActivityData: Record<string, any> = {};
let partyActivityData: Record<string, any> = {};

try {
  const dataPath = path.join(__dirname, '..', '..', 'data', 'parliamentary-activity.json');
  console.log('Attempting to load parliamentary data from:', dataPath);
  
  if (fs.existsSync(dataPath)) {
    const rawData = fs.readFileSync(dataPath, 'utf8');
    parliamentaryActivityData = JSON.parse(rawData);
    console.log(`Loaded parliamentary data for ${Object.keys(parliamentaryActivityData).length} politicians`);
    console.log('Sample keys:', Object.keys(parliamentaryActivityData).slice(0, 5));
  } else {
    console.error('Parliamentary activity data file not found at:', dataPath);
  }
} catch (error) {
  console.error('Error loading parliamentary activity data:', error);
}

try {
  const partyDataPath = path.join(__dirname, '..', '..', 'data', 'party-parliamentary-activity.json');
  
  if (fs.existsSync(partyDataPath)) {
    const rawPartyData = fs.readFileSync(partyDataPath, 'utf8');
    partyActivityData = JSON.parse(rawPartyData);
    console.log(`Loaded party activity scores for ${Object.keys(partyActivityData).length} parties`);
  } else {
    console.error('Party parliamentary activity data file not found at:', partyDataPath);
  }
} catch (error) {
  console.error('Error loading party parliamentary activity data:', error);
}

// Normalize name for matching
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[áàâäã]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôöõ]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[ñ]/g, 'n')
    .replace(/[''`]/g, '')
    .replace(/[.-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Get parliamentary activity for a specific politician
router.get('/politician/:name', (req, res) => {
  try {
    const politicianName = req.params.name;
    const normalizedName = normalizeName(politicianName);
    
    // Debug logging
    console.log(`Searching for politician: "${politicianName}" -> normalized: "${normalizedName}"`);
    
    const activityData = parliamentaryActivityData[normalizedName];
    
    // If exact match fails, try fuzzy matching
    if (!activityData) {
      const availableKeys = Object.keys(parliamentaryActivityData);
      const fuzzyMatch = availableKeys.find(key => {
        const keyWords = key.split(' ');
        const nameWords = normalizedName.split(' ');
        return keyWords.length === nameWords.length && 
               keyWords.every((word, index) => word === nameWords[index]);
      });
      
      if (fuzzyMatch) {
        console.log(`Found fuzzy match: "${fuzzyMatch}" for "${normalizedName}"`);
        res.json({
          success: true,
          data: parliamentaryActivityData[fuzzyMatch]
        });
        return;
      }
      
      // Try searching by parts of the name
      const partialMatch = availableKeys.find(key => {
        const lastName = normalizedName.split(' ').pop();
        const firstNames = normalizedName.split(' ').slice(0, -1);
        return lastName && key.includes(lastName) && firstNames.some(fname => key.includes(fname));
      });
      
      if (partialMatch) {
        console.log(`Found partial match: "${partialMatch}" for "${normalizedName}"`);
        res.json({
          success: true,
          data: parliamentaryActivityData[partialMatch]
        });
        return;
      }
      
      console.log(`No match found. Available keys include: ${availableKeys.slice(0, 5).join(', ')}...`);
    }
    
    if (activityData) {
      res.json({
        success: true,
        data: activityData
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Parliamentary activity data not found for this politician'
      });
    }
  } catch (error) {
    console.error('Error fetching parliamentary activity:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get parliamentary activity statistics by party
router.get('/party/:partyId/stats', (req, res) => {
  try {
    const partyId = req.params.partyId;
    
    // Map party IDs to party names in the data
    const partyNameMapping: Record<string, string[]> = {
      'ie-ff': ['Fianna Fáil'],
      'ie-fg': ['Fine Gael'],
      'ie-sf': ['Sinn Féin'],
      'ie-labour': ['Labour Party'],
      'ie-sd': ['Social Democrats'],
      'ie-green': ['Green Party'],
      'ie-pbp': ['People Before Profit', 'Solidarity', 'People Before Profit-Solidarity'],
      'ie-aontu': ['Aontú'],
      'ie-independent-ireland': ['Independent Ireland'],
      'ie-independent': ['Independent']
    };
    
    const partyNames = partyNameMapping[partyId] || [];
    
    const partyMembers = Object.values(parliamentaryActivityData).filter((member: any) => 
      partyNames.some(name => member.party && member.party.includes(name))
    );
    
    if (partyMembers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No parliamentary activity data found for this party'
      });
    }
    
    // Calculate party statistics
    const totalMembers = partyMembers.length;
    const totalQuestions = partyMembers.reduce((sum: number, member: any) => sum + (member.questionsAsked || 0), 0);
    const totalAttendance = partyMembers.reduce((sum: number, member: any) => sum + (member.dailAttendance || 0), 0);
    const totalOtherAttendance = partyMembers.reduce((sum: number, member: any) => sum + (member.otherAttendance || 0), 0);
    
    const avgQuestions = Math.round(totalQuestions / totalMembers);
    const avgAttendance = Math.round((totalAttendance / totalMembers / 29) * 100);
    const avgOtherAttendance = Math.round(totalOtherAttendance / totalMembers);
    
    // Find top performers
    const topQuestionAsker = partyMembers.reduce((top: any, member: any) => 
      (member.questionsAsked || 0) > (top.questionsAsked || 0) ? member : top
    );
    
    const topAttendee = partyMembers.reduce((top: any, member: any) => 
      (member.attendancePercentage || 0) > (top.attendancePercentage || 0) ? member : top
    );
    
    res.json({
      success: true,
      data: {
        totalMembers,
        averageQuestions: avgQuestions,
        averageAttendance: avgAttendance,
        averageOtherAttendance: avgOtherAttendance,
        totalQuestions,
        topQuestionAsker: {
          name: topQuestionAsker.fullName,
          questions: topQuestionAsker.questionsAsked
        },
        topAttendee: {
          name: topAttendee.fullName,
          attendance: topAttendee.attendancePercentage
        },
        members: partyMembers.map((member: any) => ({
          name: member.fullName,
          questionsAsked: member.questionsAsked,
          attendancePercentage: member.attendancePercentage,
          dailAttendance: member.dailAttendance,
          otherAttendance: member.otherAttendance
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching party parliamentary stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get overall parliamentary activity statistics
router.get('/stats', (req, res) => {
  try {
    const allMembers = Object.values(parliamentaryActivityData);
    
    if (allMembers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No parliamentary activity data available'
      });
    }
    
    // Calculate overall statistics
    const totalMembers = allMembers.length;
    const totalQuestions = allMembers.reduce((sum: number, member: any) => sum + (member.questionsAsked || 0), 0);
    const avgQuestions = Math.round(totalQuestions / totalMembers);
    
    const attendanceRates = allMembers.map((member: any) => member.attendancePercentage || 0);
    const avgAttendance = Math.round(attendanceRates.reduce((sum, rate) => sum + rate, 0) / totalMembers);
    
    const otherAttendance = allMembers.map((member: any) => member.otherAttendance || 0);
    const avgOtherAttendance = Math.round(otherAttendance.reduce((sum, days) => sum + days, 0) / totalMembers);
    
    // Top performers
    const topQuestionAsker = allMembers.reduce((top: any, member: any) => 
      (member.questionsAsked || 0) > (top.questionsAsked || 0) ? member : top
    );
    
    const topAttendee = allMembers.reduce((top: any, member: any) => 
      (member.attendancePercentage || 0) > (top.attendancePercentage || 0) ? member : top
    );
    
    res.json({
      success: true,
      data: {
        totalMembers,
        totalQuestions,
        averageQuestions: avgQuestions,
        averageAttendance: avgAttendance,
        averageOtherAttendance: avgOtherAttendance,
        topQuestionAsker: {
          name: topQuestionAsker.fullName,
          questions: topQuestionAsker.questionsAsked,
          party: topQuestionAsker.party
        },
        topAttendee: {
          name: topAttendee.fullName,
          attendance: topAttendee.attendancePercentage,
          party: topAttendee.party
        }
      }
    });
  } catch (error) {
    console.error('Error fetching parliamentary stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get party activity scores
router.get('/party/:partyName/score', (req, res) => {
  try {
    const partyName = req.params.partyName;
    
    // Create mapping from party IDs to full names
    const partyMapping: Record<string, string> = {
      'ie-sf': 'Sinn Féin',
      'ie-fg': 'Fine Gael', 
      'ie-ff': 'Fianna Fáil',
      'ie-labour': 'Labour Party',
      'ie-green': 'Green Party',
      'ie-sd': 'Social Democrats',
      'ie-pbp': 'People Before Profit-Solidarity',
      'ie-aontu': 'Aontú',
      'ie-independent-ireland': 'Independent Ireland'
    };
    
    const fullPartyName = partyMapping[partyName] || partyName;
    const activityData = partyActivityData[fullPartyName];
    
    if (activityData) {
      res.json({
        success: true,
        data: {
          party: fullPartyName,
          activityScore: activityData.combinedActivityScore || activityData.activityScore,
          questionsAsked: activityData.questionsAsked,
          tdCount: activityData.tdCount,
          questionsPerTD: activityData.questionsPerTD,
          averageAttendance: activityData.averageAttendance,
          attendanceScore: activityData.attendanceScore,
          questionsScore: activityData.questionsScore,
          combinedActivityScore: activityData.combinedActivityScore,
          weighting: activityData.weighting
        }
      });
    } else {
      // Return a default score for parties not in the data
      res.json({
        success: true,
        data: {
          party: fullPartyName,
          activityScore: 50, // Neutral score
          questionsAsked: 0,
          tdCount: 1,
          questionsPerTD: 0,
          averageAttendance: null,
          attendanceScore: null,
          questionsScore: null,
          combinedActivityScore: 50,
          weighting: 'No data available'
        }
      });
    }
  } catch (error) {
    console.error('Error fetching party activity score:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get top performers across all parties
router.get('/top-performers', (req, res) => {
  try {
    const allMembers = Object.values(parliamentaryActivityData);
    
    if (allMembers.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    // Sort by questions asked and get top 10
    const topPerformers = allMembers
      .filter((member: any) => member.questionsAsked && member.questionsAsked > 0)
      .sort((a: any, b: any) => (b.questionsAsked || 0) - (a.questionsAsked || 0))
      .slice(0, 10)
      .map((member: any) => ({
        name: member.fullName,
        questions: member.questionsAsked,
        party: member.party,
        attendance: member.attendancePercentage || 0
      }));
    
    res.json({
      success: true,
      data: topPerformers
    });
  } catch (error) {
    console.error('Error fetching top performers:', error);
    res.json({
      success: true,
      data: []
    });
  }
});

export default router;