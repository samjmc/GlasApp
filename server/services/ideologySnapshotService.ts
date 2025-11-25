import { supabaseDb } from '../db.js';
import { IDEOLOGY_DIMENSIONS } from '../constants/ideology.js';

export const IdeologySnapshotService = {
  /**
   * Create a snapshot for a specific user
   */
  async createSnapshot(userId: string): Promise<void> {
    if (!supabaseDb) {
      console.error('❌ Supabase client not available');
      return;
    }

    try {
      // Get current ideology profile
      const { data: profile, error: profileError } = await supabaseDb
        .from('user_ideology_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) {
        console.error(`❌ Error fetching profile for user ${userId}:`, profileError.message);
        return;
      }

      if (!profile) {
        console.log(`⚠️ No profile found for user ${userId}, skipping snapshot`);
        return;
      }

      // Count sessions completed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count: sessionCount } = await supabaseDb
        .from('daily_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('completed_at', today.toISOString());

      // Insert snapshot
      const { error: snapshotError } = await supabaseDb
        .from('user_ideology_snapshots')
        .insert({
          user_id: userId,
          snapshot_date: today.toISOString().split('T')[0],
          economic: profile.economic,
          social: profile.social,
          cultural: profile.cultural,
          authority: profile.authority,
          environmental: profile.environmental,
          welfare: profile.welfare,
          globalism: profile.globalism,
          technocratic: profile.technocratic,
          total_weight: profile.total_weight,
          session_count: sessionCount || 0,
        })
        .select()
        .single();

      if (snapshotError) {
        // Ignore duplicate errors (snapshot already exists for today)
        if (!snapshotError.message.includes('duplicate')) {
          console.error(`❌ Error creating snapshot for user ${userId}:`, snapshotError.message);
        }
      } else {
        console.log(`✅ Created ideology snapshot for user ${userId.substring(0, 8)}...`);
      }
    } catch (error: any) {
      console.error(`❌ Snapshot creation failed for user ${userId}:`, error.message);
    }
  },

  /**
   * Create snapshots for all active users
   */
  async createAllSnapshots(): Promise<{ created: number; errors: number }> {
    if (!supabaseDb) {
      console.error('❌ Supabase client not available');
      return { created: 0, errors: 1 };
    }

    console.log('📸 Starting daily snapshot creation for all users...');

    // Get all users with ideology profiles
    const { data: profiles, error: profilesError } = await supabaseDb
      .from('user_ideology_profiles')
      .select('user_id, total_weight')
      .gt('total_weight', 0); // Only users with actual data

    if (profilesError) {
      console.error('❌ Error fetching user profiles:', profilesError.message);
      return { created: 0, errors: 1 };
    }

    if (!profiles || profiles.length === 0) {
      console.log('⚠️ No user profiles found to snapshot');
      return { created: 0, errors: 0 };
    }

    console.log(`Found ${profiles.length} users to snapshot`);

    let created = 0;
    let errors = 0;

    for (const profile of profiles) {
      try {
        await this.createSnapshot(profile.user_id);
        created++;
      } catch (error: any) {
        console.error(`Error creating snapshot for user ${profile.user_id}:`, error.message);
        errors++;
      }
    }

    console.log(`✅ Snapshot creation complete: ${created} created, ${errors} errors`);
    return { created, errors };
  },

  /**
   * Log an ideology event (quiz completion, major shift, milestone)
   */
  async logEvent(
    userId: string,
    eventType: 'quiz_completed' | 'major_shift' | 'milestone' | 'session_streak',
    options: {
      dimension?: string;
      magnitude?: number;
      metadata?: any;
      label?: string;
      icon?: string;
      eventDate?: Date;
    } = {}
  ): Promise<void> {
    if (!supabaseDb) {
      console.error('❌ Supabase client not available');
      return;
    }

    try {
      const { error } = await supabaseDb
        .from('user_ideology_events')
        .insert({
          user_id: userId,
          event_type: eventType,
          event_date: (options.eventDate || new Date()).toISOString(),
          dimension: options.dimension || null,
          magnitude: options.magnitude || null,
          metadata: options.metadata || null,
          label: options.label || null,
          icon: options.icon || null,
        });

      if (error) {
        console.error(`❌ Error logging event for user ${userId}:`, error.message);
      } else {
        console.log(`✅ Logged ${eventType} event for user ${userId.substring(0, 8)}...`);
      }
    } catch (error: any) {
      console.error(`❌ Event logging failed for user ${userId}:`, error.message);
    }
  },

  /**
   * Check for major shifts and log them as events
   */
  async detectAndLogMajorShifts(userId: string): Promise<void> {
    if (!supabaseDb) return;

    try {
      // Get last 2 snapshots
      const { data: snapshots } = await supabaseDb
        .from('user_ideology_snapshots')
        .select('*')
        .eq('user_id', userId)
        .order('snapshot_date', { ascending: false })
        .limit(2);

      if (!snapshots || snapshots.length < 2) {
        return; // Not enough data to compare
      }

      const [current, previous] = snapshots;

      // Check each dimension for major shift (>3 points)
      for (const dimension of IDEOLOGY_DIMENSIONS) {
        const currentValue = Number(current[dimension]) || 0;
        const previousValue = Number(previous[dimension]) || 0;
        const delta = Math.abs(currentValue - previousValue);

        if (delta > 3.0) {
          const direction = currentValue > previousValue ? 'right' : 'left';
          await this.logEvent(userId, 'major_shift', {
            dimension,
            magnitude: delta,
            metadata: {
              from: previousValue,
              to: currentValue,
              direction,
            },
            label: `Big shift on ${dimension}: ${delta.toFixed(1)} points ${direction}`,
            icon: direction === 'right' ? '↗️' : '↙️',
          });
        }
      }
    } catch (error: any) {
      console.error(`❌ Error detecting major shifts for user ${userId}:`, error.message);
    }
  },

  /**
   * Check for milestones and log them
   */
  async checkMilestones(userId: string): Promise<void> {
    if (!supabaseDb) return;

    try {
      // Check session streak
      const { count: sessionCount } = await supabaseDb
        .from('daily_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed');

      if (sessionCount && [10, 25, 50, 100].includes(sessionCount)) {
        await this.logEvent(userId, 'milestone', {
          metadata: { sessions: sessionCount },
          label: `${sessionCount} sessions completed! 🎉`,
          icon: '🏆',
        });
      }

      // Check snapshot count
      const { count: snapshotCount } = await supabaseDb
        .from('user_ideology_snapshots')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (snapshotCount && [7, 30, 90, 365].includes(snapshotCount)) {
        await this.logEvent(userId, 'milestone', {
          metadata: { days: snapshotCount },
          label: `${snapshotCount} days tracked! 📅`,
          icon: '📊',
        });
      }
    } catch (error: any) {
      console.error(`❌ Error checking milestones for user ${userId}:`, error.message);
    }
  },

  /**
   * Get user's snapshots for time-series
   */
  async getSnapshots(userId: string, fromDate?: Date, toDate?: Date): Promise<any[]> {
    if (!supabaseDb) return [];

    try {
      let query = supabaseDb
        .from('user_ideology_snapshots')
        .select('*')
        .eq('user_id', userId)
        .order('snapshot_date', { ascending: true });

      if (fromDate) {
        query = query.gte('snapshot_date', fromDate.toISOString().split('T')[0]);
      }

      if (toDate) {
        query = query.lte('snapshot_date', toDate.toISOString().split('T')[0]);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`❌ Error fetching snapshots for user ${userId}:`, error.message);
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error(`❌ Snapshot fetch failed for user ${userId}:`, error.message);
      return [];
    }
  },

  /**
   * Get user's ideology events for annotations
   */
  async getEvents(userId: string, fromDate?: Date, toDate?: Date): Promise<any[]> {
    if (!supabaseDb) return [];

    try {
      let query = supabaseDb
        .from('user_ideology_events')
        .select('*')
        .eq('user_id', userId)
        .order('event_date', { ascending: true });

      if (fromDate) {
        query = query.gte('event_date', fromDate.toISOString());
      }

      if (toDate) {
        query = query.lte('event_date', toDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error(`❌ Error fetching events for user ${userId}:`, error.message);
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error(`❌ Event fetch failed for user ${userId}:`, error.message);
      return [];
    }
  },
};


