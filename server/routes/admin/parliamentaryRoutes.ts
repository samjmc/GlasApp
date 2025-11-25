/**
 * Parliamentary Data Admin Routes
 * Endpoints for managing Oireachtas API integration
 */

import { Router } from 'express';
import { parliamentaryDataJob } from '../../jobs/parliamentaryDataUpdateJob';
import { OireachtasAPIService } from '../../services/oireachtasAPIService';

const router = Router();

/**
 * POST /api/admin/parliamentary/update - Trigger parliamentary data update
 */
router.post('/update', async (req, res, next) => {
  try {
    console.log('🔄 Manual parliamentary data update triggered...');
    
    // Run in background
    setTimeout(async () => {
      try {
        await parliamentaryDataJob.triggerManual();
        console.log('✅ Parliamentary update completed');
      } catch (error) {
        console.error('❌ Parliamentary update failed:', error);
      }
    }, 100);
    
    res.json({
      success: true,
      message: 'Parliamentary data update started in background',
      estimated_duration: '10-20 minutes',
      note: 'Fetches data from Oireachtas API for all 160 TDs'
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/parliamentary/test-member - Test API for one member
 */
router.get('/test-member/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    
    console.log(`🧪 Testing Oireachtas API for ${name}...`);
    
    // Get all members
    const members = await OireachtasAPIService.getCurrentDailMembers();
    const member = members.find(m => m.fullName.toLowerCase().includes(name.toLowerCase()));
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: `Member ${name} not found`,
        available_members: members.slice(0, 10).map(m => m.fullName)
      });
    }
    
    // Get activity
    const activity = await OireachtasAPIService.getCompleteMemberActivity(member);
    
    res.json({
      success: true,
      member: {
        name: member.fullName,
        party: member.party,
        constituency: member.constituency
      },
      activity,
      api_status: 'working'
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/parliamentary/members - Get all current members from API
 */
router.get('/members', async (req, res, next) => {
  try {
    const members = await OireachtasAPIService.getCurrentDailMembers();
    
    res.json({
      success: true,
      total: members.length,
      members: members.map(m => ({
        name: m.fullName,
        party: m.party,
        constituency: m.constituency
      }))
    });
    
  } catch (error) {
    next(error);
  }
});

export default router;

